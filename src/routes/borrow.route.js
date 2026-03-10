import express from 'express';
import { requestBorrow, approveBorrow, cancelBorrow, returnBook, getMyBorrows, getAllBorrows } from '../controllers/borrow.controller.js';
import { authenticate, isInternal } from '../middleware/auth.middleware.js';

const router = express.Router();

// User routes
router.post('/borrow/request', authenticate, requestBorrow);
router.get('/borrow/me', authenticate, getMyBorrows);

// Admin/Staff routes
router.get('/borrow/all', authenticate, isInternal, getAllBorrows);
router.post('/borrow/approve', authenticate, isInternal, approveBorrow);
router.post('/borrow/cancel', authenticate, isInternal, cancelBorrow);
router.post('/borrow/return', authenticate, isInternal, returnBook);

export default router;
