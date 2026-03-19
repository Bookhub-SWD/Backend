import { supabase } from '../lib/supabase.js';
import { notifyEvent } from '../lib/email.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const generateRegistrationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `EVT-${code}`;
};

// ─── Public ───────────────────────────────────────────────────────────────────

/**
 * GET /api/events
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
      .select('*, created_by_user:users!events_created_by_fkey (id, full_name, email), registrations:event_registrations (id)', { count: 'exact' });

    const now = new Date().toISOString();

    if (status && status.trim() !== '') {
        const s = status.trim().toLowerCase();
        if (s === 'upcoming') {
            query = query.gt('start_time', now);
        } else if (s === 'ongoing') {
            query = query.lte('start_time', now).gte('end_time', now);
        } else if (s === 'completed') {
            query = query.lt('end_time', now);
        } else {
            query = query.eq('status', s);
        }
    }
    if (search && search.trim() !== '') query = query.ilike('title', `%${search.trim()}%`);

    const { data: events, error, count } = await query
      .order('start_time', { ascending: true })
      .range(from, to);

    if (error) return res.status(500).json({ ok: false, message: error.message });

    const eventsWithCounts = events.map(event => {
      const { registrations, ...eventInfo } = event;
      return { ...eventInfo, registered_count: registrations?.length || 0 };
    });

    return res.status(200).json({
      ok: true,
      data: eventsWithCounts,
      pagination: { page, limit, total_items: count, total_pages: Math.ceil(count / limit) },
    });
  } catch (err) {
    console.error('getEvents error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/events/:id
 */
export const getEventDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: event, error } = await supabase
      .from('events')
      .select(`
        *,
        created_by_user:users!events_created_by_fkey (id, full_name, email),
        registrations:event_registrations (
          id, status, registration_code, attended_at, created_at,
          user:users!event_registrations_user_id_fkey (id, full_name, email)
        )
      `)
      .eq('id', id)
      .single();

    if (error) return res.status(404).json({ ok: false, message: 'Event not found' });

    const registered_count = event.registrations?.filter(r => r.status === 'registered').length || 0;
    const attended_count = event.registrations?.filter(r => r.status === 'attended').length || 0;

    return res.status(200).json({
      ok: true,
      data: { ...event, registered_count, attended_count },
    });
  } catch (err) {
    console.error('getEventDetail error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// ─── Admin/Librarian — CRUD ───────────────────────────────────────────────────

/**
 * POST /api/events
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
      .insert([{ title, description: description || null, location: location || null, banner_url: banner_url || null, max_participants: max_participants || null, start_time, end_time, created_by: userId }])
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    const emailResult = await notifyEvent('create', data, req.user.full_name || req.user.email);
    return res.status(201).json({ ok: true, message: 'Event created successfully', data, email_status: emailResult });
  } catch (err) {
    console.error('createEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * PUT /api/events/:id
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

    if (start_time && end_time && new Date(start_time) >= new Date(end_time)) {
      return res.status(400).json({ ok: false, message: 'start_time must be before end_time' });
    }

    const { data, error } = await supabase
      .from('events')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    const emailResult = await notifyEvent('update', data, req.user.full_name || req.user.email);
    return res.status(200).json({ ok: true, message: 'Event updated successfully', data, email_status: emailResult });
  } catch (err) {
    console.error('updateEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/events/:id
 */
export const deleteEvent = async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) return res.status(400).json({ ok: false, message: error.message });
    return res.status(200).json({ ok: true, message: 'Event deleted successfully' });
  } catch (err) {
    console.error('deleteEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

// ─── Admin/Librarian — Check-in & Reject ─────────────────────────────────────

/**
 * POST /api/events/check-in
 * Body: { registration_code }
 */
export const checkInEvent = async (req, res) => {
  try {
    const { registration_code, note } = req.body;
    if (!registration_code) return res.status(400).json({ ok: false, message: 'registration_code is required' });

    const normalizedCode = registration_code.trim().toUpperCase();
    console.log('[checkInEvent] Searching for code:', normalizedCode);

    const { data: reg, error: findError } = await supabase
      .from('event_registrations')
      .select('id, status, event:events (id, title, start_time), user:users!event_registrations_user_id_fkey (id, full_name, email)')
      .eq('registration_code', normalizedCode)
      .single();

    if (findError || !reg) {
      console.error('[checkInEvent] Error or not found:', findError);
      return res.status(404).json({ ok: false, message: `Registration code "${normalizedCode}" not found` });
    }

    if (reg.status !== 'registered') {
      return res.status(400).json({
        ok: false,
        message: reg.status === 'attended' ? 'Already checked in' : `Registration status is "${reg.status}"`,
        data: { user: reg.user, event: reg.event, status: reg.status },
      });
    }

    const attendedAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('event_registrations')
      .update({ status: 'attended', attended_at: attendedAt })
      .eq('id', reg.id);

    if (updateError) return res.status(500).json({ ok: false, message: updateError.message });

    return res.status(200).json({
      ok: true,
      message: 'Check-in successful',
      data: { user: reg.user, event: reg.event, status: 'attended', attended_at: attendedAt },
    });
  } catch (err) {
    console.error('checkInEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/events/registrations/check-code/:code
 * Get registration details by code (for librarian/admin reveal before check-in)
 */
export const getRegistrationByCode = async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ ok: false, message: 'code is required' });

    const normalizedCode = code.trim().toUpperCase();

    const { data: reg, error } = await supabase
      .from('event_registrations')
      .select('id, status, registration_code, attended_at, created_at, event:event_id (id, title, start_time), user:user_id (id, full_name, email)')
      .eq('registration_code', normalizedCode)
      .single();

    if (error || !reg) {
      return res.status(404).json({ ok: false, message: `Registration code "${normalizedCode}" not found` });
    }

    return res.status(200).json({
      ok: true,
      data: reg,
    });
  } catch (err) {
    console.error('getRegistrationByCode error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};


// ─── User — Registration ──────────────────────────────────────────────────────

/**
 * POST /api/events/:id/register
 * Returns registration_code for QR display
 */
export const registerEvent = async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;

    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*, registrations:event_registrations(id)')
      .eq('id', eventId)
      .single();

    if (eventError || !event) return res.status(404).json({ ok: false, message: 'Event not found' });
    if (event.status !== 'upcoming') return res.status(400).json({ ok: false, message: 'Can only register for upcoming events' });

    const currentCount = event.registrations?.length || 0;
    if (event.max_participants && currentCount >= event.max_participants) {
      return res.status(400).json({ ok: false, message: 'Event is full' });
    }

    const { data: existing } = await supabase
      .from('event_registrations')
      .select('id, status, registration_code')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return res.status(400).json({
        ok: false,
        message: 'Already registered for this event',
        data: { registration_code: existing.registration_code, status: existing.status },
      });
    }

    // Guarantee uniqueness
    let registrationCode;
    let isUnique = false;
    while (!isUnique) {
      registrationCode = generateRegistrationCode();
      const { data: conflict } = await supabase
        .from('event_registrations')
        .select('id')
        .eq('registration_code', registrationCode)
        .maybeSingle();
      if (!conflict) isUnique = true;
    }

    const { data, error } = await supabase
      .from('event_registrations')
      .insert([{ event_id: eventId, user_id: userId, registration_code: registrationCode }])
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(201).json({
      ok: true,
      message: 'Registered successfully',
      data: {
        id: data.id,
        registration_code: data.registration_code,
        status: data.status,
        event_id: data.event_id,
        created_at: data.created_at,
      },
    });
  } catch (err) {
    console.error('registerEvent error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/events/:id/register
 * Cancel only if status = 'registered'
 */
export const cancelRegistration = async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;

    const { data: existing } = await supabase
      .from('event_registrations')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!existing) return res.status(404).json({ ok: false, message: 'Registration not found' });
    if (existing.status !== 'registered') {
      return res.status(400).json({ ok: false, message: `Cannot cancel a registration with status "${existing.status}"` });
    }

    const { error } = await supabase.from('event_registrations').delete().eq('id', existing.id);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Registration cancelled successfully' });
  } catch (err) {
    console.error('cancelRegistration error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/events/:id/my-registration
 * Get own registration info (includes QR registration_code)
 */
export const getMyRegistration = async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = req.params.id;

    const { data, error } = await supabase
      .from('event_registrations')
      .select('id, status, registration_code, attended_at, created_at')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) return res.status(500).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, data: data || null });
  } catch (err) {
    console.error('getMyRegistration error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/events/my-registrations
 * All events the authenticated user registered for
 */
export const getMyRegistrations = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('event_registrations')
      .select(`
        id, status, registration_code, attended_at, created_at,
        event:event_id (id, title, description, location, banner_url, start_time, end_time, status)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, data: data || [] });
  } catch (err) {
    console.error('getMyRegistrations error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
