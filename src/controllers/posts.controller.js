import { supabase } from '../lib/supabase.js';

/**
 * GET /api/posts
 * List posts with user and book details, plus like count.
 */
export const getPosts = async (req, res) => {
  try {
    const { book_id, user_id } = req.query;
    const currentUserId = req.user?.id;

    let query = supabase
      .from('posts')
      .select(`
        *,
        user:user_id (id, full_name, email, avatar_url),
        book:book_id (id, title, author, url_img),
        likes:post_likes (user_id),
        comments:comments (id)
      `)
      .eq('status', 'published');

    if (book_id) query = query.eq('book_id', book_id);
    if (user_id) query = query.eq('user_id', user_id);

    const { data: posts, error } = await query.order('created_at', { ascending: false });

    if (error) return res.status(500).json({ ok: false, message: error.message });

    // Process counts and liked status
    const result = posts.map(post => ({
      ...post,
      like_count: post.likes?.length || 0,
      comment_count: post.comments?.length || 0,
      is_liked: currentUserId ? post.likes?.some(l => l.user_id === currentUserId) : false,
      likes: undefined, // Hide raw likes list
      comments: undefined
    }));

    return res.status(200).json({ ok: true, data: result });
  } catch (err) {
    console.error('getPosts error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/posts
 */
export const createPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { book_id, content, image_url } = req.body;

    if (!book_id || !content) {
      return res.status(400).json({ ok: false, message: 'book_id and content are required' });
    }

    const { data, error } = await supabase
      .from('posts')
      .insert([{ user_id: userId, book_id, content, image_url }])
      .select()
      .single();

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(201).json({ ok: true, message: 'Post created successfully', data });
  } catch (err) {
    console.error('createPost error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * POST /api/posts/:id/like
 * Toggle like/unlike
 */
export const toggleLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.id;

    // Check if already liked
    const { data: existingLike } = await supabase
      .from('post_likes')
      .select()
      .eq('post_id', postId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingLike) {
      // Unlike
      await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', userId);
      return res.status(200).json({ ok: true, message: 'Unliked', liked: false });
    } else {
      // Like
      await supabase.from('post_likes').insert([{ post_id: postId, user_id: userId }]);
      return res.status(200).json({ ok: true, message: 'Liked', liked: true });
    }
  } catch (err) {
    console.error('toggleLike error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};

/**
 * DELETE /api/posts/:id
 */
export const deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const userRole = req.user.roles?.name?.toLowerCase();

    const query = supabase
      .from('posts')
      .delete()
      .eq('id', id);

    // If not Admin/Librarian, ensure user is owner
    if (userRole !== 'admin' && userRole !== 'librarian') {
      query.eq('user_id', userId);
    }

    const { error } = await query;

    if (error) return res.status(400).json({ ok: false, message: error.message });

    return res.status(200).json({ ok: true, message: 'Post deleted successfully' });
  } catch (err) {
    console.error('deletePost error:', err);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
};
