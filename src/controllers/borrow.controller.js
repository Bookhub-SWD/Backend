import { supabase } from '../lib/supabase.js';

/**
 * Helper to generate a unique request code (QR)
 */
const generateRequestCode = () => {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
};

/**
 * POST /api/borrow/request
 * User requests a book.
 * Body: { book_id }
 */
export const requestBorrow = async (req, res) => {
  try {
    const userId = req.user.id;
    const { book_id } = req.body;

    if (!book_id) return res.status(400).json({ ok: false, message: 'book_id is required' });

    // 1. Check if user already has an active borrow or request for this book
    const { data: existingRecords } = await supabase
      .from('borrow_records')
      .select('id, status, copy:copy_id(book_id)')
      .eq('user_id', userId)
      .in('status', ['requested', 'borrowed']);

    const alreadyHasBook = existingRecords?.some(r => r.copy.book_id === book_id);
    if (alreadyHasBook) {
      return res.status(400).json({ ok: false, message: 'You already have an active request or borrow for this book' });
    }

    // 2. Find an available copy
    const { data: availableCopy, error: copyError } = await supabase
      .from('book_copies')
      .select('id')
      .eq('book_id', book_id)
      .eq('status', 'available')
      .limit(1)
      .maybeSingle();

    if (copyError) return res.status(500).json({ ok: false, message: copyError.message });

    if (!availableCopy) {
      // 3. If no copy, add to reservations queue
      const { data: reservation, error: resError } = await supabase
        .from('reservations')
        .insert([{ user_id: userId, book_id }])
        .select()
        .single();

      if (resError) return res.status(500).json({ ok: false, message: resError.message });

      return res.status(200).json({
        ok: true,
        message: 'No available copies. You have been added to the waiting list.',
        data: { reservation_id: reservation.id, status: 'waiting' }
      });
    }

    // 4. Reserve the copy and create borrow record
    const requestCode = generateRequestCode();

    // Start "transaction" (Sequentially)
    await supabase.from('book_copies').update({ status: 'reserved' }).eq('id', availableCopy.id);

    const { data: record, error: recordError } = await supabase
      .from('borrow_records')
      .insert([{
        user_id: userId,
        copy_id: availableCopy.id,
        status: 'requested',
        request_code: requestCode
      }])
      .select()
      .single();

    if (recordError) {
      // Rollback copy status
      await supabase.from('book_copies').update({ status: 'available' }).eq('id', availableCopy.id);
      return res.status(500).json({ ok: false, message: recordError.message });
    }

    return res.status(201).json({
      ok: true,
      message: 'Borrow request created successfully',
      data: {
        request_code: requestCode,
        copy_id: availableCopy.id,
        status: 'requested'
      }
    });
  } catch (err) {
    console.error('requestBorrow error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/borrow/approve
 * Librarian/Staff approves the request by scanning QR.
 * Body: { request_code, days_to_borrow }
 */
export const approveBorrow = async (req, res) => {
  try {
    const { request_code, days_to_borrow = 14 } = req.body;

    if (!request_code) return res.status(400).json({ ok: false, message: 'request_code is required' });

    // 1. Find the requested record
    const { data: record, error: recordError } = await supabase
      .from('borrow_records')
      .select('id, copy_id, status')
      .eq('request_code', request_code)
      .eq('status', 'requested')
      .single();

    if (recordError || !record) return res.status(404).json({ ok: false, message: 'Matching request not found or not in "requested" status' });

    const borrowDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + days_to_borrow);

    // 2. Update record and copy status
    await supabase.from('book_copies').update({ status: 'borrowed' }).eq('id', record.copy_id);

    const { data: updatedRecord, error: updateError } = await supabase
      .from('borrow_records')
      .update({
        status: 'borrowed',
        borrow_date: borrowDate.toISOString(),
        due_date: dueDate.toISOString()
      })
      .eq('id', record.id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ ok: false, message: updateError.message });

    return res.status(200).json({
      ok: true,
      message: 'Borrow request approved',
      data: updatedRecord
    });
  } catch (err) {
    console.error('approveBorrow error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/borrow/cancel
 * Librarian/Staff cancels/rejects the request.
 * Body: { request_code, note }
 */
export const cancelBorrow = async (req, res) => {
  try {
    const { request_code, note } = req.body;

    if (!request_code) return res.status(400).json({ ok: false, message: 'request_code is required' });

    // 1. Find the requested record
    const { data: record, error: recordError } = await supabase
      .from('borrow_records')
      .select('id, copy_id, status')
      .eq('request_code', request_code)
      .eq('status', 'requested')
      .single();

    if (recordError || !record) return res.status(404).json({ ok: false, message: 'Matching request not found or not in "requested" status' });

    // 2. Update record to "cancelled" and set the note
    const { data: updatedRecord, error: updateError } = await supabase
      .from('borrow_records')
      .update({
        status: 'cancelled',
        note: note || 'Rejected by staff'
      })
      .eq('id', record.id)
      .select()
      .single();

    if (updateError) return res.status(500).json({ ok: false, message: updateError.message });

    // 3. Make the copy available again
    await supabase.from('book_copies').update({ status: 'available' }).eq('id', record.copy_id);

    return res.status(200).json({
      ok: true,
      message: 'Borrow request cancelled/rejected successfully',
      data: updatedRecord
    });
  } catch (err) {
    console.error('cancelBorrow error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/borrow/return
 * Librarian/Staff scans physical book barcode to return.
 * Body: { barcode }
 */
export const returnBook = async (req, res) => {
  try {
    const { barcode } = req.body;

    if (!barcode) return res.status(400).json({ ok: false, message: 'barcode is required' });

    // 1. Find the copy
    const { data: copy, error: copyError } = await supabase
      .from('book_copies')
      .select('id, book_id')
      .eq('barcode', barcode)
      .single();

    if (copyError || !copy) return res.status(404).json({ ok: false, message: 'Book copy not found' });

    // 2. Find active borrow record
    const { data: record, error: recordError } = await supabase
      .from('borrow_records')
      .select('id')
      .eq('copy_id', copy.id)
      .eq('status', 'borrowed')
      .single();

    if (recordError || !record) return res.status(404).json({ ok: false, message: 'Active borrow record not found for this copy' });

    // 3. Calculate fines
    const dueDate = new Date(record.due_date);
    const returnDate = new Date();
    const isOverdue = returnDate > dueDate;
    let fineAmount = 0;

    if (isOverdue) {
      const diffTime = Math.abs(returnDate - dueDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fineAmount = diffDays * 5000; // 5000 VND per day

      // Create fine record
      const { error: fineError } = await supabase
        .from('fines')
        .insert([{
          borrow_record_id: record.id,
          user_id: record.user_id,
          amount: fineAmount,
          status: 'pending'
        }]);

      if (fineError) console.error('Error creating fine:', fineError);
    }

    // 4. Update record to returned
    await supabase
      .from('borrow_records')
      .update({ status: 'returned', return_date: returnDate.toISOString() })
      .eq('id', record.id);

    // 5. Queue logic: Check if anyone is waiting for this book
    const { data: nextReservation } = await supabase
      .from('reservations')
      .select('id, user_id')
      .eq('book_id', copy.book_id)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (nextReservation) {
      // Reserve for the next person
      await supabase.from('book_copies').update({ status: 'reserved' }).eq('id', copy.id);

      // Notify user (Update reservation)
      await supabase
        .from('reservations')
        .update({ status: 'notified', notified_at: new Date().toISOString() })
        .eq('id', nextReservation.id);

      return res.status(200).json({
        ok: true,
        message: isOverdue ? `Book returned late. Fine: ${fineAmount} VND.` : 'Book returned successfully.',
        fine: fineAmount,
        next_reservation: nextReservation.user_id
      });
    }

    // 6. If no one waiting, make available
    await supabase.from('book_copies').update({ status: 'available' }).eq('id', copy.id);
    return res.status(200).json({
      ok: true,
      message: isOverdue ? `Book returned late. Fine: ${fineAmount} VND.` : 'Book returned successfully.',
      fine: fineAmount
    });
  } catch (err) {
    console.error('returnBook error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/borrow/me
 * User gets their own borrow history.
 */
export const getMyBorrows = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: records, error } = await supabase
      .from('borrow_records')
      .select(`
        *,
        copy:copy_id (
          barcode,
          book:book_id (id, title, author, url_img)
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, data: records });
  } catch (err) {
    console.error('getMyBorrows error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/borrow/all
 * Admin gets all borrow records.
 */
export const getAllBorrows = async (req, res) => {
  try {
    const { data: records, error } = await supabase
      .from('borrow_records')
      .select(`
        *,
        user:user_id (id, full_name, email),
        copy:copy_id (
          barcode,
          book:book_id (id, title, author)
        )
      `)
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, data: records });
  } catch (err) {
    console.error('getAllBorrows error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
