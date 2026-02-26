import { supabase } from '../lib/supabase.js';

/**
 * GET /api/books?subject=xxx
 * Query books by subject (partial match on subject code or name).
 * If no subject query param, return all books.
 */
export const getBooks = async (req, res) => {
  try {
    const { title, subject_code, category } = req.query;

    // Base query
    let query = supabase
      .from('books')
      .select(`
        *,
        library:library_id (id, name, location),
        book_subjects (
          subject:subject_code (code, name, category)
        )
      `);

    // 1. Filter by Title (if provided)
    if (title && title.trim() !== '') {
      query = query.ilike('title', `%${title.trim()}%`);
    }

    // 2. Filter by Subjects (if code or category provided)
    if (
      (subject_code && subject_code.trim() !== '') || 
      (category && category.trim() !== '')
    ) {
      let subjectQuery = supabase.from('subjects').select('code');
      
      if (subject_code && subject_code.trim() !== '') {
        subjectQuery = subjectQuery.ilike('code', `%${subject_code.trim()}%`);
      }
      if (category && category.trim() !== '') {
        subjectQuery = subjectQuery.ilike('category', `%${category.trim()}%`);
      }

      const { data: matchedSubjects } = await subjectQuery;

      if (!matchedSubjects || matchedSubjects.length === 0) {
        return res.status(200).json({ ok: true, data: [] });
      }

      const codes = matchedSubjects.map(s => s.code);
      const { data: bookSubjects } = await supabase
        .from('book_subjects')
        .select('book_id')
        .in('subject_code', codes);

      if (!bookSubjects || bookSubjects.length === 0) {
        return res.status(200).json({ ok: true, data: [] });
      }

      const bookIds = [...new Set(bookSubjects.map(b => b.book_id))];
      query = query.in('id', bookIds);
    }

    const { data: books, error } = await query.order('created_at', { ascending: false });
    if (error) return res.status(500).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, data: books });
  } catch (err) {
    console.error('getBooks error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/books
 * Body: { title, author, publisher, isbn, keyword, description, url_img, library_id, subjects: [{code, name, category}] }
 */
export const createBook = async (req, res) => {
  try {
    const { subjects, ...bookData } = req.body;
    
    // Default library_id to 2
    if (!bookData.library_id) bookData.library_id = 2;

    // 1. Insert Book
    const { data: book, error: bookError } = await supabase
      .from('books')
      .insert(bookData)
      .select()
      .single();

    if (bookError) return res.status(400).json({ ok: false, message: bookError.message });

    // 2. Handle Subjects
    if (subjects && Array.isArray(subjects) && subjects.length > 0) {
      // Upsert subjects (create if not exist)
      const { error: subjectUpsertError } = await supabase
        .from('subjects')
        .upsert(subjects.map(s => ({ 
          code: s.code, 
          name: s.name || null, 
          category: s.category || null 
        })), { onConflict: 'code' });

      if (subjectUpsertError) return res.status(400).json({ ok: false, message: 'Subject upsert failed: ' + subjectUpsertError.message });

      // Link book to subjects
      const links = subjects.map(s => ({
        book_id: book.id,
        subject_code: s.code
      }));

      const { error: linkError } = await supabase.from('book_subjects').insert(links);
      if (linkError) return res.status(400).json({ ok: false, message: 'Linking subjects failed: ' + linkError.message });
    }

    return res.status(201).json({ ok: true, message: 'Book created successfully', data: book });
  } catch (err) {
    console.error('createBook error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * PUT /api/books/:id
 */
export const updateBook = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjects, ...bookData } = req.body;

    // 1. Update Book
    const { data: book, error: bookError } = await supabase
      .from('books')
      .update(bookData)
      .eq('id', id)
      .select()
      .single();

    if (bookError) return res.status(400).json({ ok: false, message: bookError.message });

    // 2. Update Subjects if provided
    if (subjects && Array.isArray(subjects)) {
      // Clear old links
      await supabase.from('book_subjects').delete().eq('book_id', id);

      if (subjects.length > 0) {
        // Upsert new subjects
        await supabase.from('subjects').upsert(subjects.map(s => ({ 
          code: s.code, 
          name: s.name || null, 
          category: s.category || null 
        })), { onConflict: 'code' });

        // Link new subjects
        const links = subjects.map(s => ({
          book_id: id,
          subject_code: s.code
        }));
        await supabase.from('book_subjects').insert(links);
      }
    }

    return res.status(200).json({ ok: true, message: 'Book updated successfully', data: book });
  } catch (err) {
    console.error('updateBook error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/books/:id
 */
export const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    // book_subjects should be deleted via FK cascade if configured, 
    // but we can manually delete them to be safe.
    await supabase.from('book_subjects').delete().eq('book_id', id);

    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Book deleted successfully' });
  } catch (err) {
    console.error('deleteBook error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/books/search?q=xxx
 * Search books that contain the keyword in their 'keyword' array.
 */
export const searchBooksByKeyword = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ ok: false, message: 'Query parameter q is required' });
    }

    // 1. Get matching book IDs from RPC
    const { data: matchedIds, error: rpcError } = await supabase
      .rpc('get_book_ids_by_keyword', { search_term: q.trim() });

    if (rpcError) return res.status(500).json({ ok: false, message: rpcError.message });

    if (!matchedIds || matchedIds.length === 0) {
      return res.status(200).json({ ok: true, data: [] });
    }

    const ids = matchedIds.map(item => item.id);

    // 2. Fetch full book details for these IDs
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select(`
        *,
        library:library_id (id, name, location),
        book_subjects (
          subject:subject_code (code, name, category)
        )
      `)
      .in('id', ids);

    if (fetchError) return res.status(500).json({ ok: false, message: fetchError.message });

    return res.status(200).json({ ok: true, data: books });
  } catch (err) {
    console.error('searchBooksByKeyword error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/books/:id
 * Get detailed book info, including reviews and average score.
 */
export const getBookDetail = async (req, res) => {
  try {
    const { id } = req.params;

    // 1. Fetch Book Data (with library and subjects)
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select(`
        *,
        library:library_id (id, name, location),
        book_subjects (
          subject:subject_code (code, name, category)
        )
      `)
      .eq('id', id)
      .single();

    if (bookError) {
      if (bookError.code === 'PGRST116') return res.status(404).json({ ok: false, message: 'Book not found' });
      return res.status(500).json({ ok: false, message: bookError.message });
    }

    // 2. Fetch Reviews (with reviewer name)
    const { data: reviews, error: reviewsError } = await supabase
      .from('reviews')
      .select(`
        id,
        content,
        score,
        created_at,
        user:user_id (id, full_name)
      `)
      .eq('book_id', id);

    if (reviewsError) return res.status(500).json({ ok: false, message: reviewsError.message });

    // 3. Calculate Average Score
    let avgScore = 0;
    if (reviews && reviews.length > 0) {
      const total = reviews.reduce((sum, review) => sum + Number(review.score), 0);
      avgScore = Number((total / reviews.length).toFixed(1));
    }

    return res.status(200).json({
      ok: true,
      data: {
        ...book,
        reviews: reviews || [],
        average_score: avgScore,
        total_reviews: reviews ? reviews.length : 0
      }
    });
  } catch (err) {
    console.error('getBookDetail error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
