import express from 'express';
import itemsRouter from './item.routes.js';
import authRouter from './auth.routes.js';
import usersRouter from './users.routes.js';
import transactionRoutes from './transaction.routes.js';
import configRouter from './config.routes.js'; // Import config router for PayPal configuration

const router = express.Router();

router.use('/items', itemsRouter); // Use items router for item-related routes
router.use('/auth',  authRouter); // Use auth router for authentication routes
router.use('/users', usersRouter); // Use users router for user-related routes
router.use(transactionRoutes); // Use transaction routes for transaction-related routes
router.use('/config', configRouter); // Use config router for PayPal configuration

export default router;