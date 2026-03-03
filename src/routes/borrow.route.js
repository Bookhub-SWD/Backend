import express from 'express';
import { requestBorrow, approveBorrow, cancelBorrow, returnBook, getMyBorrows, getAllBorrows } from '../controllers/borrow.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// User routes
router.post('/borrow/request', authenticate, requestBorrow);
router.get('/borrow/me', authenticate, getMyBorrows);

// Admin/Staff routes
router.get('/borrow/all', authenticate, isAdmin, getAllBorrows);
<<<<<<< HEAD
router.post('/borrow/approve', authenticate, isAdmin, approveBorrow);
router.post('/borrow/cancel', authenticate, isAdmin, cancelBorrow);
=======
router.post('/borrow/approve', authenticate, approveBorrow);
>>>>>>> 557b9e4b3cd98774a49c856c6ecfeb7b433615c4
router.post('/borrow/return', authenticate, isAdmin, returnBook);

export default router;
