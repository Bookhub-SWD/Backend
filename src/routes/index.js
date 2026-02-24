import express from 'express';
import authRoutes from './auth.route.js';

const router = express.Router();

// Welcome route
router.get('/', (req, res) => {
  res.json({ message: 'Welcome to BookHub API' });
});

// Auth routes
router.use('/auth', authRoutes);

export default router;
