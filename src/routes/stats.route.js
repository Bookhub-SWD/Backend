import express from 'express';
import { getDashboardStats, getBorrowingTrends } from '../controllers/stats.controller.js';
import { authenticate, isInternal } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats/dashboard', authenticate, isInternal, getDashboardStats);
router.get('/stats/borrowing-trends', authenticate, isInternal, getBorrowingTrends);

export default router;
