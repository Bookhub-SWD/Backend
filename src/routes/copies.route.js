import express from 'express';
import { getCopies, getCopyById, createCopy, updateCopy, deleteCopy } from '../controllers/copies.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// All copy routes require authentication and admin/staff privileges
router.use(authenticate, isAdmin);

router.get('/copies', getCopies);
router.get('/copies/:id', getCopyById);
router.post('/copies', createCopy);
router.put('/copies/:id', updateCopy);
router.delete('/copies/:id', deleteCopy);

export default router;
