import express from 'express';
import { deleteComment } from '../controllers/comments.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// Delete a comment (must be owner)
router.delete('/comments/:id', authenticate, deleteComment);

export default router;
