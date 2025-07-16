import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  plan: {
    type: String,
    enum: ['monthly', 'yearly'],
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'expired', 'pending'],
    default: 'pending',
    index: true
  },
  paypalSubscriptionId: {
    type: String,
    sparse: true,
    index: true
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true,
    index: true
  },
  nextBillingDate: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancellationReason: {
    type: String
  },
  autoRenew: {
    type: Boolean,
    default: true
  },
  lastRenewalDate: {
    type: Date
  },
  renewalNotificationShown: {
    type: Boolean,
    default: false
  }
}, { 
  timestamps: true 
});

// Compound indexes for efficient queries
subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ status: 1, endDate: 1 });

// Methods
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && new Date() < this.endDate;
};

subscriptionSchema.methods.isExpired = function() {
  return new Date() >= this.endDate;
};

export default mongoose.model('Subscription', subscriptionSchema);