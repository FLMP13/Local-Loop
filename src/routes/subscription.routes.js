// Backend/src/routes/subscription.routes.js
// Routes for subscription management

import express from 'express';
import {
  getCurrentSubscription,
  getSubscriptionHistory,
  createSubscription,
  cancelSubscription,
  checkRenewalNotifications
} from '../controllers/subscription.controller.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Subscription management routes
router.get('/me', auth, getCurrentSubscription);           // Get my current subscription
router.get('/me/history', auth, getSubscriptionHistory);   // Get my subscription history
router.get('/me/notifications', auth, checkRenewalNotifications); // Check for renewal notifications
router.post('/me/create', auth, createSubscription);       // Create/upgrade subscription
router.post('/me/cancel', auth, cancelSubscription);       // Cancel my subscription

export default router;
