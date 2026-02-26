import { supabase } from '../lib/supabase.js';

/**
 * GET /api/books?subject=xxx
 * Query books by subject (partial match on subject code or name).
 * If no subject query param, return all books.
 */
export const getBooks = async (req, res) => {
  try {
    const { subject } = req.query;

    // Base query: books joined with book_subjects + subjects
    let query = supabase
      .from('books')
      .select(`
        id,
        title,
        author,
        publisher,
        isbn,
        keyword,
        description,
        created_at,
        url_img,
        library:library_id (
          id,
          name,
          location
        ),
        book_subjects (
          subject:subject_code (
            code,
            name,
            category
          )
        )
      `);

    // If subject provided, filter books that have at least one matching subject
    if (subject && subject.trim() !== '') {
      // Get matching subject codes first (partial ilike match)
      const { data: matchedSubjects, error: subjectError } = await supabase
        .from('subjects')
        .select('code')
        .or(`code.ilike.%${subject}%,name.ilike.%${subject}%`);

      if (subjectError) {
        return res.status(500).json({ ok: false, message: subjectError.message });
      }

      if (!matchedSubjects || matchedSubjects.length === 0) {
        return res.status(200).json({ ok: true, data: [] });
      }

      const codes = matchedSubjects.map((s) => s.code);

      // Get book_ids that have those subject codes
      const { data: bookSubjects, error: bsError } = await supabase
        .from('book_subjects')
        .select('book_id')
        .in('subject_code', codes);

      if (bsError) {
        return res.status(500).json({ ok: false, message: bsError.message });
      }

      if (!bookSubjects || bookSubjects.length === 0) {
        return res.status(200).json({ ok: true, data: [] });
      }

      const bookIds = [...new Set(bookSubjects.map((b) => b.book_id))];
      query = query.in('id', bookIds);
    }

    const { data: books, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }

    return res.status(200).json({
      ok: true,
      data: books,
    });
  } catch (err) {
    console.error('getBooks error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
