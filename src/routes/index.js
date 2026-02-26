import express from 'express';
import authRoutes from './auth.route.js';
import booksRoutes from './books.route.js';
import subjectsRoutes from './subjects.route.js';
import favoritesRoutes from './favorites.route.js';

const router = express.Router();

// Welcome route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to BookHub API' });
});

router.use('/', authRoutes);
router.use('/', booksRoutes);
router.use('/', subjectsRoutes);
router.use('/', favoritesRoutes);

export default router;
