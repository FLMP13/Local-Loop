import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  item:      { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  lender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  borrower:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  status:    { type: String, enum: ['requested', 'accepted', 'rejected', 'borrowed', 'returned', 'completed'], default: 'requested' },
  requestDate: { type: Date, default: Date.now },
  returnDate: { type: Date},
  requestedFrom: { type: Date, required: true },
  requestedTo:   { type: Date, required: true },
  lenderReviewed: { type: Boolean, default: false },
  borrowerReviewed: { type: Boolean, default: false }
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;