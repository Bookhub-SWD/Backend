import express from 'express';
import { getDashboardStats, getBorrowingTrends, exportLibraryReport } from '../controllers/stats.controller.js';
import { authenticate, isInternal } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats/dashboard', authenticate, isInternal, getDashboardStats);
router.get('/stats/borrowing-trends', authenticate, isInternal, getBorrowingTrends);
router.get('/stats/export', authenticate, isInternal, exportLibraryReport);

export default router;
