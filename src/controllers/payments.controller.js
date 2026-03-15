import { supabase } from '../lib/supabase.js';
import { sendFineReminder, sendFineInvoice } from '../lib/email.js';

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
        const { user_id } = req.query;

        let query = supabase
            .from('fines')
            .select(`
        *,
        user:users!fines_user_id_fkey1 (id, full_name, email),
        borrow_record:borrow_record_id (
          id,
          due_date,
          return_date,
          copy:copy_id (
            book:book_id (id, title, author, url_img)
          )
        )
      `);

        if (user_id) {
            query = query.eq('user_id', user_id);
        }

        const { data: fines, error } = await query.order('created_at', { ascending: false });

        if (error) return res.status(500).json({ ok: false, message: error.message });

        return res.status(200).json({ ok: true, data: fines });
    } catch (err) {
        console.error('getAllFines error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/payments/pending
 * Get all pending fines with urgency calculation (Admin/Librarian).
 */
export const getPendingFines = async (req, res) => {
    try {
        const { data: fines, error } = await supabase
            .from('fines')
            .select(`
                *,
                user:users!fines_user_id_fkey1 (id, full_name, email),
                borrow_record:borrow_record_id (
                    id,
                    due_date,
                    return_date,
                    copy:copy_id (
                        book:book_id (id, title, author)
                    )
                )
            `)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ ok: false, message: error.message });

        const now = new Date();
        const processed = fines.map(f => {
            const dueDate = new Date(f.borrow_record?.due_date);
            const diffTime = now.getTime() - dueDate.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return {
                ...f,
                days_overdue: diffDays > 0 ? diffDays : 0,
                days_left: diffDays < 0 ? Math.abs(diffDays) : 0
            };
        }).sort((a, b) => b.days_overdue - a.days_overdue);

        return res.status(200).json({ ok: true, data: processed });
    } catch (err) {
        console.error('getPendingFines error:', err);
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
        const isInternal = ['admin', 'librarian', 'staff'].includes(req.user.roles.name.toLowerCase());

        if (!isOwner && !isInternal) {
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

        // 3. Send detailed invoice email (async)
        try {
            const { data: fullFine } = await supabase
                .from('fines')
                .select(`
                    *,
                    user:users!fines_user_id_fkey1 (id, full_name, email),
                    borrow_record:borrow_record_id (
                        id,
                        return_date,
                        copy:copy_id (
                            book:book_id (id, title)
                        )
                    )
                `)
                .eq('id', id)
                .single();

            if (fullFine && fullFine.user?.email) {
                sendFineInvoice(fullFine.user.email, fullFine.user.full_name, {
                    fineId: fullFine.id,
                    bookTitle: fullFine.borrow_record?.copy?.book?.title || 'Sách mượn',
                    amount: fullFine.amount,
                    paidAt: fine.paid_at,
                    returnDate: fullFine.borrow_record?.return_date || new Date().toISOString()
                });
            }
        } catch (emailErr) {
            console.error('Failed to trigger invoice email:', emailErr);
        }

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

/**
 * POST /api/payments/webhook/sepay
 * Receive webhook from SePay for bank transfers
 */
export const handleSepayWebhook = async (req, res) => {
    try {
        const payload = req.body;
        
        // Basic auth/validation (optional depending on SePay config, e.g. checking API key in headers)
        // SePay usually sends { id, gateway, transactionDate, accountNo, code, content, transferType, transferAmount, accumulated, subAccountCode, referenceCode, description }
        
        if (!payload || (!payload.content && !payload.description) || !payload.transferAmount) {
            return res.status(400).json({ success: false, message: 'Invalid payload' });
        }

        const content = (payload.content || payload.description).toUpperCase();
        const amount = Number(payload.transferAmount);

        console.log(`[SePay Webhook] Received payment: ${amount} VND. Content: ${content}`);

        // Extract Fine ID from content (Format: BOOKHUB<ID> or BOOKHUB <ID>)
        const match = content.match(/BOOKHUB\s*(\d+)/);
        if (!match) {
            console.log('[SePay Webhook] Ignore: No matching BOOKHUB syntax found');
            return res.status(200).json({ success: true, message: 'Ignored: No matching syntax' });
        }

        const fineId = match[1];

        // 1. Find the fine
        const { data: fine, error: findError } = await supabase
            .from('fines')
            .select('id, amount, status')
            .eq('id', fineId)
            .single();

        if (findError || !fine) {
            console.log(`[SePay Webhook] Error: Fine ID ${fineId} not found`);
            return res.status(404).json({ success: false, message: 'Fine not found' });
        }

        if (fine.status === 'paid') {
            console.log(`[SePay Webhook] Ignored: Fine ID ${fineId} is already paid`);
            return res.status(200).json({ success: true, message: 'Already paid' });
        }

        // 2. Verify amount
        if (amount < Number(fine.amount)) {
            console.log(`[SePay Webhook] Error: Partial payment. Expected ${fine.amount}, got ${amount}`);
            // Could set status to 'partial' or just log it depending on rules. Leaving it pending for now.
            return res.status(400).json({ success: false, message: 'Partial payment not accepted automatically' });
        }

        // 3. Update to paid
        const { error: updateError } = await supabase
            .from('fines')
            .update({
                status: 'paid',
                paid_at: new Date().toISOString(),
            })
            .eq('id', fine.id);

        if (updateError) {
            console.error(`[SePay Webhook] Update Error:`, updateError);
            return res.status(500).json({ success: false, message: 'Database error' });
        }

        // 4. Send detailed invoice email (async)
        try {
            const { data: fullFine } = await supabase
                .from('fines')
                .select(`
                    *,
                    user:users!fines_user_id_fkey1 (id, full_name, email),
                    borrow_record:borrow_record_id (
                        id,
                        return_date,
                        copy:copy_id (
                            book:book_id (id, title)
                        )
                    )
                `)
                .eq('id', fine.id)
                .single();

            if (fullFine && fullFine.user?.email) {
                sendFineInvoice(fullFine.user.email, fullFine.user.full_name, {
                    fineId: fullFine.id,
                    bookTitle: fullFine.borrow_record?.copy?.book?.title || 'Sách mượn',
                    amount: fullFine.amount,
                    paidAt: new Date().toISOString(),
                    returnDate: fullFine.borrow_record?.return_date || new Date().toISOString()
                });
            }
        } catch (emailErr) {
            console.error('[SePay Webhook] Failed to trigger invoice email:', emailErr);
        }

        console.log(`[SePay Webhook] Success: Fine ID ${fine.id} marked as paid`);
        return res.status(200).json({ success: true, message: 'Payment processed successfully' });

    } catch (err) {
        console.error('handleSepayWebhook error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

/**
 * GET /api/payments/status/:id
 * Check the real-time status of a fine (used for polling after showing QR)
 */
export const checkFineStatus = async (req, res) => {
    try {
        const { id } = req.params;
        
        const { data: fine, error } = await supabase
            .from('fines')
            .select('status, paid_at')
            .eq('id', id)
            .single();
            
        if (error || !fine) {
            return res.status(404).json({ ok: false, message: 'Fine not found' });
        }
        
        return res.status(200).json({ ok: true, data: fine });
    } catch (err) {
        console.error('checkFineStatus error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};

/**
 * POST /api/payments/:id/notify
 * Send manual email reminder to user about a fine.
 */
export const notifyFineReminder = async (req, res) => {
    try {
        const { id } = req.params;

        const { data: fine, error } = await supabase
            .from('fines')
            .select(`
                *,
                user:users!fines_user_id_fkey1 (id, full_name, email),
                borrow_record:borrow_record_id (
                    id,
                    due_date,
                    copy:copy_id (
                        book:book_id (id, title)
                    )
                )
            `)
            .eq('id', id)
            .single();

        if (error || !fine) return res.status(404).json({ ok: false, message: 'Fine not found' });
        if (fine.status === 'paid') return res.status(400).json({ ok: false, message: 'Fine is already paid' });
        if (!fine.user?.email) return res.status(400).json({ ok: false, message: 'User has no email registered' });

        const dueDate = new Date(fine.borrow_record?.due_date);
        const diffDays = Math.ceil((new Date() - dueDate) / (1000 * 60 * 60 * 24));

        const result = await sendFineReminder(fine.user.email, fine.user.full_name, {
            bookTitle: fine.borrow_record?.copy?.book?.title || 'Sách mượn',
            amount: fine.amount,
            daysOverdue: diffDays > 0 ? diffDays : 0,
            dueDate: fine.borrow_record?.due_date
        });

        if (!result.success) {
            return res.status(500).json({ ok: false, message: 'Failed to send email', error: result.error });
        }

        return res.status(200).json({ ok: true, message: 'Reminder sent successfully' });
    } catch (err) {
        console.error('notifyFineReminder error:', err);
        return res.status(500).json({ ok: false, message: 'Internal server error' });
    }
};
