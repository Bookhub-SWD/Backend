import express from 'express';
import { googleLogin, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/auth/google', googleLogin);
router.get('/auth/me', authenticate, getMe);

export default router;
