import express from 'express';
import { getCopies, getCopyById, createCopy, updateCopy, deleteCopy } from '../controllers/copies.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/copies', authenticate, isAdmin, getCopies);
router.get('/copies/:id', authenticate, isAdmin, getCopyById);
router.post('/copies', authenticate, isAdmin, createCopy);
router.put('/copies/:id', authenticate, isAdmin, updateCopy);
router.delete('/copies/:id', authenticate, isAdmin, deleteCopy);

export default router;
