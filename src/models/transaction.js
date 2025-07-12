import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
  item:      { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  lender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  borrower:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
  status: {
    type: String,
    enum: [
      'requested', 'accepted', 'paid', 'rejected', 'borrowed', 'returned', 'completed',
      'renegotiation_requested', 'retracted'
    ],
    default: 'requested'
  },
  requestDate: { type: Date, default: Date.now },
  requestedFrom: { type: Date, required: true },
  requestedTo:   { type: Date, required: true },
  
  // Financial tracking
  deposit: { type: Number },    // Security deposit (usually 5x base price)
  totalAmount: { type: Number }, // Total amount paid (calculated lending fee + deposit)
  
  renegotiation: {
    from: { type: Date },
    to: { type: Date },
    message: { type: String }
  },
  lenderMessage: { type: String },   // for decline/renegotiation
  borrowerMessage: { type: String }, // for renegotiation response
  lenderReviewed: { type: Boolean, default: false },
  borrowerReviewed: { type: Boolean, default: false },
  returnCode: { type: String },
  returnCodeGenerated: { type: Boolean, default: false },
  returnCodeUsed: { type: Boolean, default: false },
  pickupCode: { type: String },
  pickupCodeUsed: { type: Boolean, default: false },
});

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;