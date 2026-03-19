import { supabase } from '../lib/supabase.js';
import * as xlsx from 'xlsx';

/**
 * GET /api/books?subject=xxx
 * Query books by subject (partial match on subject code or name).
 * If no subject query param, return all books.
 */
export const getBooks = async (req, res) => {
  try {
    const { title, search, subject_code, category, unclassified } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    // Base query with count
    let query = supabase
      .from('books')
      .select(`
        *,
        library:library_id (id, name, location),
        subjects:book_subjects (
          subject:subject_code (code, name, category)
        ),
        book_copies(status)
      `, { count: 'exact' });

    const searchVal = (search || title || '').trim();
    if (searchVal !== '') {
      query = query.ilike('title', `%${searchVal}%`);
    }

    // 2. Filter by Subjects (if code or category provided)
    if (unclassified === 'true') {
      // Find all book_ids that HAVE a subject
      const { data: bookSubjects } = await supabase
        .from('book_subjects')
        .select('book_id');
      
      const classifiedIds = bookSubjects ? [...new Set(bookSubjects.map(bs => bs.book_id))] : [];
      
      if (classifiedIds.length > 0) {
        query = query.not('id', 'in', `(${classifiedIds.join(',')})`);
      }
    } else if (
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
        return res.status(200).json({ ok: true, data: [], pagination: { page, limit, total_items: 0, total_pages: 0 } });
      }

      const codes = matchedSubjects.map(s => s.code);
      const { data: bookSubjects } = await supabase
        .from('book_subjects')
        .select('book_id')
        .in('subject_code', codes);

      if (!bookSubjects || bookSubjects.length === 0) {
        return res.status(200).json({ ok: true, data: [], pagination: { page, limit, total_items: 0, total_pages: 0 } });
      }

      const bookIds = [...new Set(bookSubjects.map(b => b.book_id))];
      query = query.in('id', bookIds);
    }

    const { data: books, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) return res.status(500).json({ ok: false, message: error.message });

    // Process copy counts
    const booksWithCounts = books.map(book => {
      const copies = book.book_copies || [];
      const total_copies = copies.length;
      const available_copies = copies.filter(c => c.status === 'available').length;

      const { book_copies, ...bookInfo } = book;
      return {
        ...bookInfo,
        total_copies,
        available_copies
      };
    });

    return res.status(200).json({
      ok: true,
      data: booksWithCounts,
      pagination: {
        page,
        limit,
        total_items: count || 0,
        total_pages: Math.ceil((count || 0) / limit)
      }
    });
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
    const { 
      title, author, publisher, isbn, 
      keyword, description, url_img, library_id,
      subjects
    } = req.body;

    // Normalize ISBN
    let cleanIsbn = isbn ? String(isbn).trim().replace(/[^0-9X]/gi, '') : null;

    const bookData = {
      title, author, publisher, 
      isbn: cleanIsbn,
      keyword, description, url_img,
      library_id: library_id || req.user?.library_id || 1
    };

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
    const { 
      title, author, publisher, isbn, 
      keyword, description, url_img, library_id,
      subjects
    } = req.body;

    const bookData = {
      title, author, publisher, isbn,
      keyword, description, url_img,
      library_id
    };

    // Remove undefined fields to avoid overwriting with null if they weren't sent
    Object.keys(bookData).forEach(key => bookData[key] === undefined && delete bookData[key]);

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

    // 1. Kiểm tra xem sách có đang được mượn không
    const { data: copies, error: copyError } = await supabase
      .from('book_copies')
      .select('status')
      .eq('book_id', id)
      .eq('status', 'borrowed');

    if (copyError) return res.status(400).json({ ok: false, message: copyError.message });

    if (copies && copies.length > 0) {
      return res.status(400).json({ ok: false, message: 'Không thể xóa sách đang có người mượn' });
    }

    // Xóa các bảng phụ thuộc
    await supabase.from('book_subjects').delete().eq('book_id', id);
    await supabase.from('book_copies').delete().eq('book_id', id);

    const { error } = await supabase.from('books').delete().eq('id', id);
    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Xóa sách thành công' });
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
        subjects:book_subjects (
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
        subjects:book_subjects (
          subject:subject_code (code, name, category)
        ),
        book_copies (*)
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
        user:users!reviews_user_id_fkey (id, full_name)
      `)
      .eq('book_id', id);

    if (reviewsError) return res.status(500).json({ ok: false, message: reviewsError.message });

    // 3. Calculate Average Score
    let avgScore = 0;
    if (reviews && reviews.length > 0) {
      const total = reviews.reduce((sum, review) => sum + Number(review.score), 0);
      avgScore = Number((total / reviews.length).toFixed(1));
    }

    // 4. Calculate Copy Counts
    const copies = book.book_copies || [];
    const total_copies = copies.length;
    const available_copies = copies.filter(c => c.status === 'available').length;

    const { book_copies, ...bookInfo } = book;

    return res.status(200).json({
      ok: true,
      data: {
        ...bookInfo,
        reviews: reviews || [],
        average_score: avgScore,
        total_reviews: reviews ? reviews.length : 0,
        total_copies,
        available_copies,
        copies: book_copies // Detail might want the full list of copies (barcode, status)
      }
    });
  } catch (err) {
    console.error('getBookDetail error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/books/isbn/:isbn
 * Lookup book by ISBN. Try DB first, fallback to Google Books.
 */
export const getBookByIsbn = async (req, res) => {
  try {
    const { isbn } = req.params;
    if (!isbn) return res.status(400).json({ ok: false, message: 'ISBN is required' });

    // 1. Try DB first
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select(`
        *,
        library:library_id (id, name, location),
        subjects:book_subjects (
          subject:subject_code (code, name, category)
        ),
        book_copies (*)
      `)
      .eq('isbn', isbn)
      .maybeSingle();

    if (book && !bookError) {
      // Record already exists in DB, fetch reviews too for completeness
      const { data: reviews } = await supabase
        .from('reviews')
        .select(`id, content, score, created_at, user:users!reviews_user_id_fkey (id, full_name)`)
        .eq('book_id', book.id);

      let avgScore = 0;
      if (reviews && reviews.length > 0) {
        avgScore = Number((reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length).toFixed(1));
      }

      const copies = book.book_copies || [];
      const total_copies = copies.length;
      const available_copies = copies.filter(c => c.status === 'available').length;

      return res.status(200).json({
        ok: true,
        is_external: false,
        data: {
          ...book,
          reviews: reviews || [],
          average_score: avgScore,
          total_reviews: reviews?.length || 0,
          total_copies,
          available_copies
        }
      });
    }

    // 2. Fallback to Open Library
    console.log(`ISBN ${isbn} not found in DB, querying Open Library...`);
    const bibkey = `ISBN:${isbn}`;
    const olRes = await fetch(`https://openlibrary.org/api/books?bibkeys=${bibkey}&format=json&jscmd=data`);
    const olData = await olRes.json();

    if (olData[bibkey]) {
      const info = olData[bibkey];
      const externalBook = {
        title: info.title,
        author: info.authors ? info.authors.map(a => a.name).join(', ') : 'Unknown',
        publisher: info.publishers ? info.publishers.map(p => p.name).join(', ') : 'N/A',
        isbn: isbn,
        description: info.notes || info.excerpts?.[0]?.text || 'Thông tin mô tả đang được cập nhật.',
        url_img: info.cover ? (info.cover.large || info.cover.medium || info.cover.small) : null,
        page_count: info.number_of_pages,
        category: info.subjects ? (typeof info.subjects[0] === 'object' ? info.subjects[0].name : info.subjects[0]) : null,
        published_date: info.publish_date,
        language: info.language,
        infoLink: info.url
      };

      return res.status(200).json({
        ok: true,
        is_external: true,
        data: externalBook
      });
    }

    return res.status(404).json({ ok: false, message: 'Book not found for this ISBN' });
  } catch (err) {
    console.error('getBookByIsbn error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
/**
 * GET /api/books/subject/search?q=xxx
 * Search books by subject name or code.
 */
export const searchBooksBySubject = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim() === '') {
      return res.status(400).json({ ok: false, message: 'Query parameter q is required' });
    }

    const searchTerm = q.trim();

    // 1. Search subjects by name or code
    const { data: matchedSubjects, error: subjectError } = await supabase
      .from('subjects')
      .select('code')
      .or(`name.ilike.%${searchTerm}%,code.ilike.%${searchTerm}%`);

    if (subjectError) return res.status(500).json({ ok: false, message: subjectError.message });

    if (!matchedSubjects || matchedSubjects.length === 0) {
      return res.status(200).json({ ok: true, data: [] });
    }

    const subjectCodes = matchedSubjects.map(s => s.code);

    // 2. Get book IDs for these subjects
    const { data: bookSubjects, error: linkError } = await supabase
      .from('book_subjects')
      .select('book_id')
      .in('subject_code', subjectCodes);

    if (linkError) return res.status(500).json({ ok: false, message: linkError.message });

    if (!bookSubjects || bookSubjects.length === 0) {
      return res.status(200).json({ ok: true, data: [] });
    }

    const bookIds = [...new Set(bookSubjects.map(bs => bs.book_id))];

    // 3. Fetch full book details
    const { data: books, error: fetchError } = await supabase
      .from('books')
      .select(`
        *,
        library:library_id (id, name, location),
        subjects:book_subjects (
          subject:subject_code (code, name, category)
        ),
        book_copies(status)
      `)
      .in('id', bookIds);

    if (fetchError) return res.status(500).json({ ok: false, message: fetchError.message });

    // Process copy counts
    const booksWithCounts = books.map(book => {
      const copies = book.book_copies || [];
      const total_copies = copies.length;
      const available_copies = copies.filter(c => c.status === 'available').length;

      const { book_copies, ...bookInfo } = book;
      return {
        ...bookInfo,
        total_copies,
        available_copies
      };
    });

    return res.status(200).json({ ok: true, data: booksWithCounts });
  } catch (err) {
    console.error('searchBooksBySubject error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/books/import
 * Import books from an uploaded Excel file.
 * Expected columns: title, author, publisher, isbn, category, description, language, page_count, quantity
 */
export const importBooksExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, message: 'No file uploaded. Please provide an Excel file.' });
    }

    // 1. Parse Excel from buffer
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON array
    // raw: false ensures cells like dates/formatted strings are converted to strings
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

    if (!rows || rows.length === 0) {
      return res.status(400).json({ ok: false, message: 'The uploaded Excel file is empty.' });
    }

    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    // Default library ID
    const library_id = 2; // Fixed ID 2 as per normal creation

    // 2. Loop through each row and import
    for (const [index, row] of rows.entries()) {
      const rowNum = index + 2; // Header is row 1
      try {
        // Map Excel columns to variables (normalize keys to lowercase)
        // Some users might name headers "Title", "TITLE", "Author", etc.
        const r = {};
        for (const key in row) {
          r[key.toLowerCase().trim()] = row[key];
        }

        const title = r['title'];
        const author = r['author'];
        const publisher = r['publisher'];
        let isbn = r['isbn'];
        let category = r['category'];
        const description = r['description'];
        const url_img = r['url_img'] || r['url image'] || r['image'] || r['image_url'];
        const keyword_raw = r['keyword'] || r['keywords'] || r['tags'];
        const keyword = keyword_raw ? String(keyword_raw).split(',').map(k => k.trim()).filter(k => k) : [];
        const quantity = parseInt(r['quantity'] || r['copies']) || 1;
        const manualBarcodes = r['barcodes'] ? String(r['barcodes']).split(',').map(b => b.trim()).filter(b => b) : [];

        if (!title || !isbn) {
          throw new Error('Title and ISBN are required.');
        }

        // Clean up and Normalize ISBN
        // Excel often converts long numbers to scientific notation (e.g., 9.78E+12)
        let cleanIsbn = String(isbn).trim();
        if (cleanIsbn.includes('E+') || cleanIsbn.includes('e+')) {
          const num = parseFloat(cleanIsbn);
          if (!isNaN(num)) {
            cleanIsbn = num.toLocaleString('fullwide', { useGrouping: false });
          }
        }
        // Remove anyway non-alphanumeric characters for general use
        cleanIsbn = cleanIsbn.replace(/[^0-9X]/gi, '');
        // For the DB bigint column, we MUST only have numbers
        const isbnForDb = cleanIsbn.replace(/[^0-9]/g, '');

        // Check if book exists
        let bookId;
        const { data: existingBook } = await supabase
          .from('books')
          .select('id')
          .eq('isbn', isbnForDb)
          .maybeSingle();

        if (existingBook) {
          bookId = existingBook.id;
          // Update book
          const { error: updateError } = await supabase.from('books').update({
            title, author, publisher, description, url_img, keyword
          }).eq('id', bookId);
          
          if (updateError) {
            console.error(`[Import] Row ${rowNum} - Book update failed:`, updateError);
            throw new Error(`Book update failed: ${updateError.message}`);
          }
        } else {
          // Create new book
          const newBookObj = {
            title,
            author: author || 'Unknown',
            publisher,
            isbn: isbnForDb,
            description,
            url_img,
            keyword,
            library_id
          };

          const { data: newBook, error: bookCreateError } = await supabase
            .from('books')
            .insert(newBookObj)
            .select('id')
            .single();

          if (bookCreateError) {
            console.error(`[Import] Row ${rowNum} - Book creation failed:`, bookCreateError);
            throw new Error(`Book creation failed: ${bookCreateError.message}`);
          }
          bookId = newBook.id;
          console.log(`[Import] Row ${rowNum} - Created new book ID: ${bookId}`);
        }

        // Handle Subject (Category)
        if (category) {
          category = String(category).trim();
          const subjectCode = category.toUpperCase().replace(/\s+/g, '_').substring(0, 10);

          // Using a simple fixed ID for category if exact match is required, 
          // or we just upsert it.
          const { error: subjectUpsertError } = await supabase
            .from('subjects')
            .upsert([{
              code: subjectCode,
              name: category,
              category: category
            }], { onConflict: 'code' });

          if (!subjectUpsertError) {
             // Check if link exists
             const { data: linkExist, error: linkCheckError } = await supabase
               .from('book_subjects')
               .select('*')
               .eq('book_id', bookId)
               .eq('subject_code', subjectCode)
               .maybeSingle();
 
             if (linkCheckError) {
                console.error(`[Import] Row ${rowNum} - Subject link check failed:`, linkCheckError);
             } else if (!linkExist) {
               const { error: linkInsertError } = await supabase.from('book_subjects').insert([{ book_id: bookId, subject_code: subjectCode }]);
               if (linkInsertError) {
                 console.error(`[Import] Row ${rowNum} - Subject linking failed:`, linkInsertError);
               }
             }
           } else {
             console.error(`[Import] Row ${rowNum} - Subject upsert failed:`, subjectUpsertError);
           }
        }

        // Generate Copies (Hybrid: Manual or ISBN-prefix)
        const copiesToInsert = [];
        if (manualBarcodes.length > 0) {
          console.log(`[Import] Row ${rowNum} - Registering ${manualBarcodes.length} manual barcodes.`);
          for (const barcode of manualBarcodes) {
            copiesToInsert.push({
              book_id: bookId,
              barcode: barcode,
              status: 'available',
              condition: 'New'
            });
          }
        } else if (quantity > 0) {
          console.log(`[Import] Row ${rowNum} - Auto-generating ${quantity} barcodes (standard: ISBN-SEQ-XXXX).`);
          for (let i = 1; i <= quantity; i++) {
            // Standard: {isbn}-{seq 2 digits}-{4 alphanumeric chars}
            const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
            const seq = String(i).padStart(2, '0');
            copiesToInsert.push({
              book_id: bookId,
              barcode: `${cleanIsbn}-${seq}-${rand}`,
              status: 'available',
              condition: 'New'
            });
          }
        } else {
          console.log(`[Import] Row ${rowNum} - No barcodes or quantity provided, skipping copy creation.`);
        }

        if (copiesToInsert.length > 0) {
          const { error: copyError } = await supabase
            .from('book_copies')
            .upsert(copiesToInsert, { onConflict: 'barcode', ignoreDuplicates: true });

          if (copyError) {
            console.error(`[Import] Row ${rowNum} - Copy insertion failed:`, copyError);
            throw new Error(`Failed to insert copies: ${copyError.message}`);
          }
          console.log(`[Import] Row ${rowNum} - Successfully registered copies.`);
        }

        successCount++;
      } catch (rowErr) {
        errorCount++;
        errors.push(`Row ${rowNum}: ${rowErr.message}`);
      }
    }

    return res.status(200).json({
      ok: true,
      message: `Import complete. Success: ${successCount}, Failed: ${errorCount}.`,
      data: { successCount, errorCount, errors }
    });
  } catch (err) {
    console.error('importBooksExcel error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error processing Excel file.' });
  }
};
