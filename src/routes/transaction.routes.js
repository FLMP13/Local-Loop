import express from 'express';
import auth from '../middleware/auth.js';
import {
  requestLend,
  getAllTransactions,
  getMyBorrowings,
  getMyLendings,
  getTransactionById,
  acceptTransaction,
  declineTransaction,
  getPaymentSummary,
  completePayment,
  completeTransaction,
  renegotiateTransaction,
  acceptRenegotiation,
  declineRenegotiation,
  editTransaction,
  retractTransaction,
  generateReturnCode,
  submitReturnCode,
  forceCompleteReturn,
  generatePickupCode,
  usePickupCode,
  forcePickup,
  reportDamage,
  confirmNoDamage,
  getTransactionFinancials
} from '../controllers/transaction.controller.js';

const router = express.Router();

// Transaction routes
router.get('/', auth, getAllTransactions);
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
router.patch('/:id/edit', auth, editTransaction);
router.patch('/:id/complete-payment', auth, completePayment);
router.get('/:id/summary', auth, getPaymentSummary);
router.patch('/:id/retract', auth, retractTransaction);
router.patch('/:id/return-code', auth, generateReturnCode);
router.post('/:id/return-code', auth, submitReturnCode);
router.patch('/:id/return-complete', auth, forceCompleteReturn);
router.patch('/:id/pickup-code', auth, generatePickupCode); 
router.post('/:id/pickup-code', auth, usePickupCode); 
router.patch('/:id/force-pickup', auth, forcePickup);
router.patch('/:id/report-damage', auth, reportDamage);
router.patch('/:id/confirm-no-damage', auth, confirmNoDamage);
router.get('/:id/financials', auth, getTransactionFinancials);

export default router;