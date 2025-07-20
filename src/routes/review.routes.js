import express from 'express';
import {
  createReview,
  getUserReviews,
  canReviewTransaction
} from '../controllers/review.controller.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Setup routes for reviews 
router.post('/reviews', auth, createReview);
router.get('/reviews/user/:userId', getUserReviews);
router.get('/reviews/can-review/:transactionId', auth, canReviewTransaction);

export default router;