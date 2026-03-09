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
        user:users!fines_user_id_fkey1 (id, full_name, email),
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

        // 1. Check if exists and ownership
        const { data: existingFine, error: fetchError } = await supabase
            .from('fines')
            .select('status, user_id')
            .eq('id', id)
            .single();

        if (fetchError || !existingFine) return res.status(404).json({ ok: false, message: 'Fine not found' });

        // Security check: Only owner or Admin/Librarian can pay
        const isOwner = req.user.id === existingFine.user_id;
        const isAdmin = ['admin', 'librarian', 'staff'].includes(req.user.roles.name.toLowerCase());

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ ok: false, message: 'Unauthorized: You can only pay your own fines' });
        }

        if (existingFine.status === 'paid') return res.status(400).json({ ok: false, message: 'Fine is already paid' });

        // 2. Update to paid
        const { data: fine, error: updateError } = await supabase
            .from('fines')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString()
            })
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

/**
 * GET /api/payments/stats
 * Get fine statistics (Admin/Librarian).
 */
export const getFineStats = async (req, res) => {
    try {
        // 1. Get total paid revenue
        const { data: paidData, error: paidError } = await supabase
            .from('fines')
            .select('amount')
            .eq('status', 'paid');

        if (paidError) throw paidError;

        // 2. Get total pending amount from recorded fines
        const { data: pendingData, error: pendingError } = await supabase
            .from('fines')
            .select('amount')
            .eq('status', 'pending');

        if (pendingError) throw pendingError;

        // 3. Get total estimated fines from unreturned overdue books
        const now = new Date().toISOString();
        const { data: overdueData, error: overdueError } = await supabase
            .from('borrow_records')
            .select('due_date')
            .in('status', ['borrowed', 'overdue'])
            .lt('due_date', now);

        if (overdueError) throw overdueError;

        let totalOverdueEstimated = 0;
        overdueData.forEach(item => {
            const dueDate = new Date(item.due_date);
            const today = new Date();
            const diffDays = Math.ceil(Math.abs(today - dueDate) / (1000 * 60 * 60 * 24));
            totalOverdueEstimated += (diffDays * 5000);
        });

        const totalRevenue = paidData.reduce((sum, item) => sum + Number(item.amount), 0);
        const totalPending = pendingData.reduce((sum, item) => sum + Number(item.amount), 0) + totalOverdueEstimated;
        const pendingCount = pendingData.length + overdueData.length;
        const paidCount = paidData.length;

        return res.status(200).json({
            ok: true,
            data: {
                totalRevenue,
                totalPending,
                pendingCount,
                paidCount,
                currency: 'VND'
            }
        });
    } catch (err) {
        console.error('getFineStats error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};
/**
 * GET /api/payments/overdue/me
 * Get current user's unreturned overdue books and potential fines.
 */
export const getMyOverdueBorrows = async (req, res) => {
    try {
        const userId = req.user.id;
        const now = new Date().toISOString();

        const { data: overdues, error } = await supabase
            .from('borrow_records')
            .select(`
                id,
                due_date,
                borrow_date,
                copy:copy_id (
                    book:book_id (id, title, author)
                )
            `)
            .eq('user_id', userId)
            .in('status', ['borrowed', 'overdue'])
            .lt('due_date', now);

        if (error) return res.status(500).json({ ok: false, message: error.message });

        const processed = overdues.map(item => {
            const dueDate = new Date(item.due_date);
            const today = new Date();
            const diffTime = Math.abs(today - dueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
                ...item,
                days_overdue: diffDays,
                estimated_fine: diffDays * 5000
            };
        });

        return res.status(200).json({ ok: true, data: processed });
    } catch (err) {
        console.error('getMyOverdueBorrows error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/payments/overdue/all
 * Get all unreturned overdue books (Admin/Librarian).
 */
export const getAllOverdueBorrows = async (req, res) => {
    try {
        const now = new Date().toISOString();

        const { data: overdues, error } = await supabase
            .from('borrow_records')
            .select(`
                id,
                due_date,
                borrow_date,
                user:users!borrow_records_user_id_fkey (id, full_name, email),
                copy:copy_id (
                    book:book_id (id, title, author)
                )
            `)
            .in('status', ['borrowed', 'overdue'])
            .lt('due_date', now);

        if (error) return res.status(500).json({ ok: false, message: error.message });

        const processed = overdues.map(item => {
            const dueDate = new Date(item.due_date);
            const today = new Date();
            const diffTime = Math.abs(today - dueDate);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return {
                ...item,
                days_overdue: diffDays,
                estimated_fine: diffDays * 5000
            };
        });

        return res.status(200).json({ ok: true, data: processed });
    } catch (err) {
        console.error('getAllOverdueBorrows error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};
