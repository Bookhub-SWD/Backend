import { supabase } from '../lib/supabase.js';

/**
 * GET /api/payments/me
 * Get current user's fines.
 */
export const getMyFines = async (req, res) => {
    try {
        const userId = req.user.id;

        const { data: fines, error } = await supabase
            .from('fines')
            .select(`
        *,
        borrow_record:borrow_record_id (
          id,
          copy:copy_id (
            book:book_id (id, title, author)
          )
        )
      `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ ok: false, message: error.message });

        return res.status(200).json({ ok: true, data: fines });
    } catch (err) {
        console.error('getMyFines error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/payments/all
 * Get all fines (Admin/Librarian).
 */
export const getAllFines = async (req, res) => {
    try {
        const { data: fines, error } = await supabase
            .from('fines')
            .select(`
        *,
        user:user_id (id, full_name, email),
        borrow_record:borrow_record_id (
          id,
          copy:copy_id (
            book:book_id (id, title, author)
          )
        )
      `)
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ ok: false, message: error.message });

        return res.status(200).json({ ok: true, data: fines });
    } catch (err) {
        console.error('getAllFines error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * POST /api/payments/:id/pay
 * Mark a fine as paid.
 */
export const payFine = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: fine, error: updateError } = await supabase
            .from('fines')
            .update({ status: 'paid', paid_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (updateError) return res.status(400).json({ ok: false, message: updateError.message });

        return res.status(200).json({ ok: true, message: 'Fine paid successfully', data: fine });
    } catch (err) {
        console.error('payFine error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};
