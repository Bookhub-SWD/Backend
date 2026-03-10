import express from 'express';
import { getDashboardStats } from '../controllers/stats.controller.js';
import { authenticate, isInternal } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats/dashboard', authenticate, isInternal, getDashboardStats);

export default router;
