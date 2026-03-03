import { supabase } from '../lib/supabase.js';
import { notifyEvent } from '../lib/email.js';

/**
 * GET /api/events
 * List events with filters: status, pagination
 */
export const getEvents = async (req, res) => {
  try {
    const { status, search } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    let query = supabase
      .from('events')
      .select(`
        *,
        created_by_user:created_by (id, full_name, email),
        registrations:event_registrations (id)
      `, { count: 'exact' });

    // Filter by status
    if (status && status.trim() !== '') {
      query = query.eq('status', status.trim());
    }

    // Search by title
    if (search && search.trim() !== '') {
      query = query.ilike('title', `%${search.trim()}%`);
    }

    const { data: events, error, count } = await query
      .order('start_time', { ascending: true })
      .range(from, to);

    if (error) return res.status(500).json({ ok: false, message: error.message });

    // Process registration counts
    const eventsWithCounts = events.map(event => {
      const { registrations, ...eventInfo } = event;
      return {
        ...eventInfo,
        registered_count: registrations?.length || 0,
      };
    });

    return res.status(200).json({
      ok: true,
      data: eventsWithCounts,
      pagination: {
        page,
        limit,
        total_items: count,
        total_pages: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    console.error('getEvents error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/events/:id
 * Get event detail
 */
export const getEventDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error } = await supabase
      .from('events')
      .select(`
        *,
        created_by_user:created_by (id, full_name, email),
        registrations:event_registrations (
          id,
          status,
          created_at,
          user:user_id (id, full_name, email)
        )
      `)
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ ok: false, message: 'Event not found' });

    const registered_count = event.registrations?.filter(r => r.status === 'registered').length || 0;

    return res.status(200).json({
      ok: true,
      data: {
        ...event,
        registered_count,
      },
    });
  } catch (err) {
    console.error('getEventDetail error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/events
 * Create a new event (admin/staff only)
 * Body: { title, description, location, banner_url, max_participants, start_time, end_time }
 */
export const createEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, description, location, banner_url, max_participants, start_time, end_time } = req.body;

    if (!title || !start_time || !end_time) {
      return res.status(400).json({ ok: false, message: 'title, start_time, and end_time are required' });
    }

    if (new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ ok: false, message: 'start_time must be before end_time' });
    }

    const { data, error } = await supabase
      .from('events')
      .insert([{
        title,
        description: description || null,
        location: location || null,
        banner_url: banner_url || null,
        max_participants: max_participants || null,
        start_time,
        end_time,
        created_by: userId,
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    // Send email notification and include result in response
    const emailResult = await notifyEvent('create', data, req.user.full_name || req.user.email);

    return res.status(201).json({ ok: true, message: 'Event created successfully', data, email_status: emailResult });
  } catch (err) {
    console.error('createEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * PUT /api/events/:id
 * Update an event (admin/staff only)
 */
export const updateEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, location, banner_url, max_participants, start_time, end_time, status } = req.body;

    const updateData = { updated_at: new Date().toISOString() };

    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (location !== undefined) updateData.location = location;
    if (banner_url !== undefined) updateData.banner_url = banner_url;
    if (max_participants !== undefined) updateData.max_participants = max_participants;
    if (start_time !== undefined) updateData.start_time = start_time;
    if (end_time !== undefined) updateData.end_time = end_time;
    if (status !== undefined) updateData.status = status;

    // Validate time if both provided
    const newStart = start_time || null;
    const newEnd = end_time || null;
    if (newStart && newEnd && new Date(newStart) >= new Date(newEnd)) {
      return res.status(400).json({ ok: false, message: 'start_time must be before end_time' });
    }

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    // Send email notification and include result in response
    const emailResult = await notifyEvent('update', data, req.user.full_name || req.user.email);

    return res.status(200).json({ ok: true, message: 'Event updated successfully', data, email_status: emailResult });
  } catch (err) {
    console.error('updateEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/events/:id
 * Delete an event (admin/staff only)
 */
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Event deleted successfully' });
  } catch (err) {
    console.error('deleteEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/events/:id/register
 * Register for an event (authenticated user)
 */
export const registerEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;

    // Check if event exists and is upcoming
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, registrations:event_registrations(id)')
      .eq('id', eventId)
      .single();

    if (eventError || !event) {
      return res.status(404).json({ ok: false, message: 'Event not found' });
    }

    if (event.status !== 'upcoming') {
      return res.status(400).json({ ok: false, message: 'Can only register for upcoming events' });
    }

    // Check max participants
    const currentCount = event.registrations?.length || 0;
    if (event.max_participants && currentCount >= event.max_participants) {
      return res.status(400).json({ ok: false, message: 'Event is full' });
    }

    // Check if already registered
    const { data: existing } = await supabase
      .from('event_registrations')
      .select()
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({ ok: false, message: 'Already registered for this event' });
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .insert([{ event_id: eventId, user_id: userId }])
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(201).json({ ok: true, message: 'Registered successfully', data });
  } catch (err) {
    console.error('registerEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/events/:id/register
 * Cancel registration for an event
 */
export const cancelRegistration = async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;

    const { error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', userId);

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Registration cancelled successfully' });
  } catch (err) {
    console.error('cancelRegistration error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

