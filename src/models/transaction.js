import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  item:      { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  lender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  borrower:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  status:    { type: String, enum: ['requested', 'accepted', 'rejected', 'borrowed', 'returned'], default: 'requested' },
  requestDate: { type: Date, default: Date.now },
  // Optionally, add more fields like dueDate, returnDate, etc.
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;