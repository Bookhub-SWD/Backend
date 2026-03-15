import { supabase } from '../lib/supabase.js';

/**
 * GET /api/copies
 * List all copies, optional book_id filter.
 */
export const getCopies = async (req, res) => {
  try {
    const { book_id } = req.query;
    
    let query = supabase.from('book_copies').select('*');

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
      .select('*')
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
    const { book_id, barcode: providedBarcode, condition = 'New' } = req.body;

    if (!book_id) {
      return res.status(400).json({ ok: false, message: 'book_id is required' });
    }

    let barcode = providedBarcode?.trim();

    // Auto-generate barcode if not provided: {isbn}-{seq}-{4 alphanumeric}
    if (!barcode) {
      // 1. Fetch book ISBN
      const { data: book, error: bookErr } = await supabase
        .from('books')
        .select('isbn')
        .eq('id', book_id)
        .single();

      if (bookErr || !book) {
        return res.status(404).json({ ok: false, message: 'Book not found' });
      }

      const isbnBase = book.isbn ? String(book.isbn) : book_id.substring(0, 8);

      // 2. Count existing copies to determine next sequence number
      const { count } = await supabase
        .from('book_copies')
        .select('id', { count: 'exact', head: true })
        .eq('book_id', book_id);

      const seq = String((count || 0) + 1).padStart(2, '0');
      const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
      barcode = `${isbnBase}-${seq}-${rand}`;
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
    // Strip immutable fields to prevent PostgreSQL errors
    const { id: _id, book_id, created_at, ...updateData } = req.body;

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
