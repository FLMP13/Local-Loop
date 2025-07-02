import express from 'express';
import {
  requestLend,
  getMyBorrowings,
  getMyLendings,
  getTransactionById,
  acceptTransaction,
  declineTransaction
} from '../controllers/transaction.controller.js';
import auth from '../middleware/auth.js';

const router = express.Router();

router.post('/transactions/request', auth, requestLend);
router.get('/transactions/borrowings', auth, getMyBorrowings);
router.get('/transactions/lendings', auth, getMyLendings);
router.get('/transactions/:id', auth, getTransactionById);
router.patch('/transactions/:id/accept', auth, acceptTransaction);
router.patch('/transactions/:id/decline', auth, declineTransaction);

export default router;