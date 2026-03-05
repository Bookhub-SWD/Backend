import express from 'express';
import {
  getEvents,
  getEventDetail,
  createEvent,
  updateEvent,
  deleteEvent,
  checkInEvent,
  rejectRegistration,
  registerEvent,
  cancelRegistration,
  getMyRegistration,
  getMyRegistrations,
} from '../controllers/events.controller.js';
import { authenticate, isAdmin } from '../middleware/auth.middleware.js';

const router = express.Router();

// ─── IMPORTANT: Static routes MUST come before dynamic /:id routes ────────────

// Public — static
router.get('/events', getEvents);

// Authenticated User — static (BEFORE /:id to avoid collision)
router.get('/events/my-registrations', authenticate, getMyRegistrations);

// Admin/Librarian — static actions (BEFORE /:id)
router.post('/events/check-in', authenticate, isAdmin, checkInEvent);
router.post('/events/reject', authenticate, isAdmin, rejectRegistration);

// Admin/Librarian — CRUD with dynamic :id
router.post('/events', authenticate, isAdmin, createEvent);
router.put('/events/:id', authenticate, isAdmin, updateEvent);
router.delete('/events/:id', authenticate, isAdmin, deleteEvent);

// Public — dynamic
router.get('/events/:id', getEventDetail);

// Authenticated User — dynamic :id
router.post('/events/:id/register', authenticate, registerEvent);
router.delete('/events/:id/register', authenticate, cancelRegistration);
router.get('/events/:id/my-registration', authenticate, getMyRegistration);

export default router;
