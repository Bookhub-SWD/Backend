import express from 'express';
import { googleLogin, getMe } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();

router.post('/google', googleLogin);
router.get('/me', authenticate, getMe);

export default router;

