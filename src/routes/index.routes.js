import express from 'express';
import itemsRouter from './item.routes.js';
import authRouter from './auth.routes.js';
import usersRouter from './users.routes.js';
import transactionRoutes from './transaction.routes.js';
import configRouter from './config.routes.js'; // Import config router for PayPal configuration
import reviewRoutes from './review.routes.js';

const router = express.Router();

router.use('/items', itemsRouter); // Use items router for item-related routes
router.use('/auth',  authRouter); // Use auth router for authentication routes
router.use('/users', usersRouter); // Use users router for user-related routes
router.use('/transactions', transactionRoutes); // Use transaction routes for transaction-related routes
router.use('/config', configRouter); // Use config router for PayPal configuration
router.use(reviewRoutes); // Use review routes for review-related routes

export default router;