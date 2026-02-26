import { supabase } from '../lib/supabase.js';

/**
 * GET /api/copies
 * List all copies, optional book_id filter.
 */
export const getCopies = async (req, res) => {
  try {
    const { book_id } = req.query;
    
    let query = supabase.from('book_copies').select(`
      *,
      book:book_id (id, title, author)
    `);

    if (book_id) {
      query = query.eq('book_id', book_id);
    }

    const { data: copies, error } = await query.order('created_at', { ascending: false });

    if (error) return res.status(500).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, data: copies });
  } catch (err) {
    console.error('getCopies error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/copies/:id
 */
export const getCopyById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: copy, error } = await supabase
      .from('book_copies')
      .select(`
        *,
        book:book_id (id, title, author)
      `)
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ ok: false, message: 'Copy not found' });
      return res.status(500).json({ ok: false, message: error.message });
    }

    return res.status(200).json({ ok: true, data: copy });
  } catch (err) {
    console.error('getCopyById error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/copies
 */
export const createCopy = async (req, res) => {
  try {
    const { book_id, barcode, condition = 'good' } = req.body;

    if (!book_id || !barcode) {
      return res.status(400).json({ ok: false, message: 'book_id and barcode are required' });
    }

    const { data, error } = await supabase
      .from('book_copies')
      .insert([{ book_id, barcode, condition, status: 'available' }])
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(201).json({ ok: true, message: 'Book copy created successfully', data });
  } catch (err) {
    console.error('createCopy error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * PUT /api/copies/:id
 */
export const updateCopy = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('book_copies')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Book copy updated successfully', data });
  } catch (err) {
    console.error('updateCopy error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/copies/:id
 */
export const deleteCopy = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('book_copies')
      .delete()
      .eq('id', id);

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Book copy deleted successfully' });
  } catch (err) {
    console.error('deleteCopy error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
