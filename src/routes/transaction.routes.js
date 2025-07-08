import express from 'express';
import auth from '../middleware/auth.js';
import {
  requestLend,
  getMyBorrowings,
  getMyLendings,
  getTransactionById,
  acceptTransaction,
  declineTransaction,
  completeTransaction,
  renegotiateTransaction,
  acceptRenegotiation,
  declineRenegotiation
} from '../controllers/transaction.controller.js';

const router = express.Router();

router.post('/request', auth, requestLend);
router.get('/borrowings', auth, getMyBorrowings);
router.get('/lendings', auth, getMyLendings);
router.get('/:id', auth, getTransactionById);
router.patch('/:id/accept', auth, acceptTransaction);
router.patch('/:id/decline', auth, declineTransaction);
router.patch('/:id/complete', auth, completeTransaction);
router.patch('/:id/renegotiate', auth, renegotiateTransaction);
router.patch('/:id/renegotiation/accept', auth, acceptRenegotiation);
router.patch('/:id/renegotiation/decline', auth, declineRenegotiation);

export default router;