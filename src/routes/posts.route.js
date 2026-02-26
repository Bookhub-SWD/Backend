import express from 'express';
import { getPosts, createPost, toggleLike, deletePost } from '../controllers/posts.controller.js';
import { getCommentsByPost, createComment } from '../controllers/comments.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Publicly viewable posts
router.get('/posts', getPosts);

// Protected routes
router.post('/posts', authenticate, createPost);
router.post('/posts/:id/like', authenticate, toggleLike);
router.delete('/posts/:id', authenticate, deletePost);

// Comments for a post
router.get('/posts/:postId/comments', getCommentsByPost);
router.post('/posts/:postId/comments', authenticate, createComment);

export default router;
