import { supabase } from '../lib/supabase.js';

/**
 * GET /api/posts/:postId/comments
 * Fetch comments for a post, supporting nested replies.
 */
export const getCommentsByPost = async (req, res) => {
  try {
    const { postId } = req.params;

    const { data: comments, error } = await supabase
      .from('comments')
      .select(`
        *,
        user:user_id (id, full_name, email, avatar_url)
      `)
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ ok: false, message: error.message });

    // Build comment tree
    const commentMap = {};
    const tree = [];

    comments.forEach(c => {
      c.replies = [];
      commentMap[c.id] = c;
    });

    comments.forEach(c => {
      if (c.parent_id && commentMap[c.parent_id]) {
        commentMap[c.parent_id].replies.push(c);
      } else {
        tree.push(c);
      }
    });

    return res.status(200).json({ ok: true, data: tree });
  } catch (err) {
    console.error('getCommentsByPost error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/posts/:postId/comments
 */
export const createComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { postId } = req.params;
    const { content, parent_id } = req.body;

    if (!content) return res.status(400).json({ ok: false, message: 'Content is required' });

    const { data, error } = await supabase
      .from('comments')
      .insert([{ 
        post_id: postId, 
        user_id: userId, 
        content, 
        parent_id 
      }])
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(201).json({ ok: true, message: 'Comment added', data });
  } catch (err) {
    console.error('createComment error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/comments/:id
 */
export const deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const userRole = req.user.roles?.name?.toLowerCase();

    const query = supabase
      .from('comments')
      .delete()
      .eq('id', id);

    // If not Admin/Librarian, ensure user is owner
    if (userRole !== 'admin' && userRole !== 'librarian') {
      query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Comment deleted' });
  } catch (err) {
    console.error('deleteComment error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
