import { supabase } from '../lib/supabase.js';

/**
 * GET /api/subjects
 * Fetch all subjects including code, name, and category.
 */
export const getSubjects = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('subjects')
      .select('*')
      .order('code', { ascending: true });

    if (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }

    return res.status(200).json({
      ok: true,
      data
    });
  } catch (err) {
    console.error('getSubjects error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * GET /api/subjects/categories
 * Fetch unique categories from the subjects table.
 */
export const getCategories = async (req, res) => {
  try {
    const { data: subjects, error } = await supabase
      .from('subjects')
      .select('category');

    if (error) {
      return res.status(500).json({ ok: false, message: error.message });
    }

    // Filter unique categories and remove nulls
    const categories = [...new Set(subjects.map(s => s.category))].filter(Boolean).sort();

    return res.status(200).json({
      ok: true,
      data: categories
    });
  } catch (err) {
    console.error('getCategories error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
