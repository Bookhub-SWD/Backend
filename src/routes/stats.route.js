import express from 'express';
import { getDashboardStats, getBorrowingTrends } from '../controllers/stats.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats/dashboard', authenticate, isAdmin, getDashboardStats);
router.get('/stats/borrowing-trends', authenticate, isAdmin, getBorrowingTrends);

export default router;
