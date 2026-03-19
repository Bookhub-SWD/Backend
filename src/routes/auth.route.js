import express from 'express';
import multer from 'multer';
import { googleLogin, getMe, updateMe, uploadAvatar } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/auth/google', googleLogin);
router.get('/auth/me', authenticate, getMe);
router.patch('/auth/me', authenticate, updateMe);
router.post('/auth/avatar', authenticate, upload.single('avatar'), uploadAvatar);

export default router;
