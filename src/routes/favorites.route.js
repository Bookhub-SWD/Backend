import express from 'express';
import { getFavorites, addFavorite, removeFavorite } from '../controllers/favorites.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

// All favorite routes require authentication
router.use(authenticate);

router.get('/favorites', getFavorites);
router.post('/favorites', addFavorite);
router.delete('/favorites/:bookId', removeFavorite);

export default router;
