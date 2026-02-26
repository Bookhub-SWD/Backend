import { supabase } from '../lib/supabase.js';

/**
 * GET /api/favorites
 * Get current user's favorite books.
 */
export const getFavorites = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: favorites, error } = await supabase
      .from('favorite_books')
      .select(`
        created_at,
        book:book_id (
          *,
          library:library_id (id, name, location)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, data: favorites });
  } catch (err) {
    console.error('getFavorites error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/favorites
 * Add a book to favorites.
 * Body: { book_id }
 */
export const addFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { book_id } = req.body;

    if (!book_id) {
      return res.status(400).json({ ok: false, message: 'book_id is required' });
    }

    const { data, error } = await supabase
      .from('favorite_books')
      .insert([{ user_id: userId, book_id }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        return res.status(400).json({ ok: false, message: 'Book is already in favorites' });
      }
      return res.status(400).json({ ok: false, message: error.message });
    }

    return res.status(201).json({ ok: true, message: 'Book added to favorites', data });
  } catch (err) {
    console.error('addFavorite error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/favorites/:bookId
 * Remove a book from favorites.
 */
export const removeFavorite = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bookId } = req.params;

    const { error } = await supabase
      .from('favorite_books')
      .delete()
      .eq('user_id', userId)
      .eq('book_id', bookId);

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Book removed from favorites' });
  } catch (err) {
    console.error('removeFavorite error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
