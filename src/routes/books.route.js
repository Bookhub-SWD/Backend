import express from 'express';
import { getBooks, createBook, updateBook, deleteBook, searchBooksByKeyword, getBookDetail, getBookByIsbn } from '../controllers/books.controller.js';
import { addReview } from '../controllers/reviews.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = express.Router();
//filter title, subject_code, category
router.get('/books', getBooks);
router.get('/books/search', searchBooksByKeyword);
router.get('/books/isbn/:isbn', getBookByIsbn);

router.post('/books', authenticate, createBook);
router.put('/books/:id', authenticate, updateBook);
router.delete('/books/:id', authenticate, deleteBook);
router.get('/books/:id', getBookDetail);

// Review routes
router.post('/books/:id/reviews', authenticate, addReview);

export default router;
