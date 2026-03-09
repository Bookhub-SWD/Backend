import { supabase } from '../lib/supabase.js';

/**
 * POST /api/books/:id/reviews
 * Add a review/rating for a book
 */
export const addReview = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id: bookId } = req.params;
        const { content, score } = req.body;

        if (!score || score < 1 || score > 5) {
            return res.status(400).json({ ok: false, message: 'Rating (score) must be between 1 and 5' });
        }

        if (!content) {
            return res.status(400).json({ ok: false, message: 'Review content is required' });
        }

        // Check if book exists
        const { data: book, error: bookError } = await supabase
            .from('books')
            .select('id')
            .eq('id', bookId)
            .single();

        if (bookError || !book) {
            return res.status(404).json({ ok: false, message: 'Book not found' });
        }

        // Upsert review (allows updating existing review)
        const { data: review, error: reviewError } = await supabase
            .from('reviews')
            .upsert({
                book_id: Number(bookId),
                user_id: userId,
                content,
                score: Number(score)
            }, { onConflict: 'user_id, book_id' })
            .select(`
        id,
        content,
        score,
        created_at,
        user:users!reviews_user_id_fkey (id, full_name)
      `)
            .single();

        if (reviewError) {
            return res.status(400).json({ ok: false, message: reviewError.message });
        }

        return res.status(201).json({ ok: true, message: 'Review added successfully', data: review });
    } catch (err) {
        console.error('addReview error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};
