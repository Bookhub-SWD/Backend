import express from 'express';
import { getBooks, createBook, updateBook, deleteBook, searchBooksByKeyword, getBookDetail } from '../controllers/books.controller.js';

const router = express.Router();
//filter title, subject_code, category
router.get('/books', getBooks);
router.get('/books/search', searchBooksByKeyword);

router.post('/books', createBook);
router.put('/books/:id', updateBook);
router.delete('/books/:id', deleteBook);
router.get('/books/:id', getBookDetail);

export default router;
