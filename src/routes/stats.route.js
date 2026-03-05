import express from 'express';
import { getDashboardStats } from '../controllers/stats.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/stats/dashboard', authenticate, isAdmin, getDashboardStats);

export default router;
