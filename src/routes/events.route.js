import express from 'express';
import {
  getEvents,
  getEventDetail,
  createEvent,
  updateEvent,
  deleteEvent,
  registerEvent,
  cancelRegistration,
} from '../controllers/events.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// Public routes
router.get('/events', getEvents);
router.get('/events/:id', getEventDetail);

// Admin/Staff routes - CRUD events
router.post('/events', authenticate, isAdmin, createEvent);
router.put('/events/:id', authenticate, isAdmin, updateEvent);
router.delete('/events/:id', authenticate, isAdmin, deleteEvent);

// Authenticated user routes - Registration
router.post('/events/:id/register', authenticate, registerEvent);
router.delete('/events/:id/register', authenticate, cancelRegistration);

export default router;

