import express from 'express';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favorites.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All favorite routes require authentication
router.get('/favorites', authenticate, getFavorites);
router.post('/favorites', authenticate, addFavorite);
router.delete('/favorites/:bookId', authenticate, removeFavorite);

export default router;
