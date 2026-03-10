import express from 'express';
import { getCopies, getCopyById, createCopy, updateCopy, deleteCopy } from '../controllers/copies.controller.js';
import { authenticate, isInternal } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/copies', authenticate, isInternal, getCopies);
router.get('/copies/:id', authenticate, isInternal, getCopyById);
router.post('/copies', authenticate, isInternal, createCopy);
router.put('/copies/:id', authenticate, isInternal, updateCopy);
router.delete('/copies/:id', authenticate, isInternal, deleteCopy);

export default router;
