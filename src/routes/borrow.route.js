import express from 'express';
import { requestBorrow, approveBorrow, returnBook, getMyBorrows, getAllBorrows } from '../controllers/borrow.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// User routes
router.post('/borrow/request', authenticate, requestBorrow);
router.get('/borrow/me', authenticate, getMyBorrows);

// Admin/Staff routes
router.get('/borrow/all', authenticate, isAdmin, getAllBorrows);
router.post('/borrow/approve', authenticate, approveBorrow);
router.post('/borrow/return', authenticate, isAdmin, returnBook);

export default router;
