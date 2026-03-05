import express from 'express';
import authRoutes from './auth.route.js';
import booksRoutes from './books.route.js';
import subjectsRoutes from './subjects.route.js';
import favoritesRoutes from './favorites.route.js';
import borrowRoutes from './borrow.route.js';
import copiesRoutes from './copies.route.js';
import postsRoutes from './posts.route.js';
import commentsRoutes from './comments.route.js';
import paymentsRoutes from './payments.route.js';
import eventsRoutes from './events.route.js';
import usersRoutes from './users.route.js';
import ocrRoutes from './ocr.route.js';
import statsRoutes from './stats.route.js';

const router = express.Router();

// Welcome route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to BookHub API' });
});

router.use('/', authRoutes);
router.use('/', booksRoutes);
router.use('/', subjectsRoutes);
router.use('/', favoritesRoutes);
router.use('/', borrowRoutes);
router.use('/', copiesRoutes);
router.use('/', postsRoutes);
router.use('/', commentsRoutes);
router.use('/', paymentsRoutes);
router.use('/', eventsRoutes);
router.use('/', usersRoutes);
router.use('/ocr', ocrRoutes);
router.use('/', statsRoutes);

export default router;
