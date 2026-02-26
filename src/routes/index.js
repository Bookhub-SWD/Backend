import express from 'express';
import authRoutes from './auth.route.js';
import booksRoutes from './books.route.js';

const router = express.Router();

// Welcome route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to BookHub API' });
});

router.use('/', authRoutes);
router.use('/', booksRoutes);

export default router;
