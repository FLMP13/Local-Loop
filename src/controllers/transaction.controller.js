import Transaction from '../models/transaction.js';
import Item from '../models/item.js';
import User from '../models/user.js';
import crypto from 'crypto';
import { getUserPriorityStatus, isPremiumUser, calculateRentalPricing, getUserDiscountRate } from '../utils/premiumUtils.js';

// PayPal Sandbox Account Configuration
const SANDBOX_ACCOUNTS = {
  LOCALLOOP: 'localloop@business.example.com',
  LENDER: 'gina.lenda@personal.example.com',
  BORROWER: 'max.borrow@personal.example.com'
};

// PayPal Sandbox Transfer Simulation
async function mockPayPalTransfer(fromAccount, toAccount, amount, description) {
  // For sandbox: Simulation without logging
  
  const transferId = `MOCK_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  
  // Simulate slight delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    success: true,
    transferId: transferId,
    amount: amount,
    from: fromAccount,
    to: toAccount,
    description: description,
    timestamp: new Date().toISOString()
  };
}

// Calculate platform fee (5% of lending fee)
function calculatePlatformFee(lendingFee) {
  return lendingFee * 0.05;
}

// Calculate payment to lender (95% of lending fee before any discounts)
function calculateLenderPayment(lendingFee) {
  return lendingFee * 0.95;
}

// Helper function to calculate lending fee based on duration and weekly rate (legacy)
function computeWeeklyCharge(from, to, weeklyRate) {
  const days = Math.ceil((to - from) / (1000 * 60 * 60 * 24)) + 1;
  const weeks = Math.ceil(days / 7);
  return weeks * weeklyRate;
}

// Request to borrow/lend an item
export async function requestLend(req, res) {
  try {
    const { itemId, requestedFrom, requestedTo } = req.body;
    if (!itemId || !requestedFrom || !requestedTo) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Prevent owner from requesting their own item
    if (item.owner.toString() === req.userId) {
      return res.status(400).json({ error: 'You cannot request your own item.' });
    }

    const overlapping = await Transaction.findOne({
      item: req.body.item,
      status: { $in: ['accepted', 'borrowed'] },
      $or: [
        {
          requestedFrom: { $lte: req.body.requestedTo },
          requestedTo: { $gte: req.body.requestedFrom }
        }
      ]
    });
    if (overlapping) {
      return res.status(400).json({ error: 'This time slot is already booked.' });
    }

    const transaction = await Transaction.create({
      item: itemId,
      lender: item.owner,
      borrower: req.userId,
      status: 'requested',
      requestedFrom,
      requestedTo
    });

    // Optionally update item status
    item.status = 'requested';
    await item.save();

    res.status(201).json(transaction);
  } catch (err) {
    console.error('Failed to create transaction:', err);
    res.status(500).json({ error: 'Failed to create transaction.' });
  }
}

// Get all transactions where user is borrower
export async function getMyBorrowings(req, res) {
  try {
    const transactions = await Transaction.find({ borrower: req.userId })
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'nickname email' }
      })
      .populate('lender', 'nickname email')
      .populate('borrower', 'nickname email firstName lastName premiumStatus');

    // Enhanced transaction mapping with pricing information for borrowings
    const enhancedTransactions = transactions.map(t => {
      let pricing = null;
      try {
        if (t.borrower && t.item && t.item.price !== undefined && t.item.price !== null && t.requestedFrom && t.requestedTo) {
          pricing = calculateRentalPricing(t.item.price, t.requestedFrom, t.requestedTo, t.borrower);
        } else {
          console.log('Skipping pricing calculation for transaction:', t._id, {
            hasBorrower: !!t.borrower,
            hasItem: !!t.item,
            hasPrice: t.item?.price !== undefined && t.item?.price !== null,
            hasRequestedFrom: !!t.requestedFrom,
            hasRequestedTo: !!t.requestedTo
          });
        }
      } catch (pricingError) {
        console.error('Error calculating pricing for transaction:', t._id, pricingError);
        pricing = null;
      }
      
      return {
        ...t.toObject(),
        pricing
      };
    });

    res.json(enhancedTransactions);
  } catch (err) {
    console.error('Error in getMyBorrowings:', err);
    res.status(500).json({ error: 'Failed to fetch borrowings.' });
  }
}

// Get all transactions where user is lender (with priority sorting for premium borrowers)
export async function getMyLendings(req, res) {
  try {
    const transactions = await Transaction.find({ lender: req.userId })
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'nickname email' }
      })
      .populate('borrower', 'nickname email firstName lastName premiumStatus')
      .populate('lender', 'nickname email'); 

    // Sort by premium status first, then by request date
    transactions.sort((a, b) => {
      // First by premium status (Premium first)
      const aIsPremium = isPremiumUser(a.borrower) ? 1 : 0;
      const bIsPremium = isPremiumUser(b.borrower) ? 1 : 0;
      if (aIsPremium !== bIsPremium) {
        return bIsPremium - aIsPremium;
      }
      
      // Then by request date (newer first)
      const aDate = new Date(a.requestDate || a.requestedFrom).getTime();
      const bDate = new Date(b.requestDate || b.requestedFrom).getTime();
      return bDate - aDate;
    });

    // Enhanced transaction mapping with pricing information
    const enhancedTransactions = transactions.map(t => {
      let pricing = null;
      if (t.borrower && t.item && t.requestedFrom && t.requestedTo) {
        const days = Math.ceil((new Date(t.requestedTo) - new Date(t.requestedFrom)) / (1000 * 60 * 60 * 24)) + 1;
        const weeks = Math.ceil(days / 7);
        const baseTotal = weeks * t.item.price;
        const discountRate = getUserDiscountRate(t.borrower);
        const discountAmount = baseTotal * (discountRate / 100);
        
        pricing = {
          originalPrice: baseTotal,
          finalPrice: baseTotal - discountAmount,
          discountRate: discountRate,
          discountAmount: discountAmount,
          isPremium: isPremiumUser(t.borrower),
          weeklyRate: {
            original: t.item.price,
            final: t.item.price * (1 - discountRate / 100)
          }
        };
      }
      
      return {
        ...t.toObject(),
        pricing
      };
    });

    res.json(enhancedTransactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch lendings.' });
  }
}

// Get all transactions for an item using itemId
export async function getTransactionById(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'nickname email zipCode' }
      })
      .populate('lender', 'nickname email')
      .populate('borrower', 'nickname email');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    
    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch transaction.' });
  }
}

// Accept a transaction request and set item status to 'borrowed' and transaction status to 'accepted'
export async function acceptTransaction(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.lender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    transaction.status = 'accepted';
    await transaction.save();

    // Item should be marked as borrowed when lender accepts
    if (transaction.item) {
      transaction.item.status = 'borrowed';
      await transaction.item.save();
    }

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept transaction.' });
  }
}

// Decline a transaction request and set transaction status to 'rejected' and item status to 'available'
export async function declineTransaction(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.lender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    transaction.status = 'rejected';
    await transaction.save();

    if (transaction.item) {
      transaction.item.status = 'available';
      await transaction.item.save();
    }

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to decline transaction.' });
  }
}

//Get payment summaries for transactions
// This function retrieves a summary of transactions for a specific user
export async function getPaymentSummary(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('item', 'title price')
      .populate('lender', 'firstName lastName')
      .populate('borrower', 'firstName lastName premiumStatus premiumStartDate premiumEndDate');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    //Has each user access to the transaction
    if (transaction.lender._id.toString() !== req.userId && transaction.borrower._id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to view this transaction.' });
    }

    // Calculate deposit and total amount with premium discount
    const deposit = (transaction.item ? transaction.item.price : 0) * 5;
    
    // Use stored pricing if available (transaction was already paid), otherwise calculate fresh
    let pricing, totalAmount, lendingFee;
    
    if (transaction.finalLendingFee) {
      // Use stored values from completed payment
      lendingFee = transaction.finalLendingFee;
      totalAmount = transaction.totalAmount;
      pricing = {
        originalPrice: transaction.originalLendingFee || lendingFee,
        finalPrice: lendingFee,
        discountRate: transaction.discountRate || 0,
        discountAmount: transaction.discountApplied || 0,
        isPremium: transaction.isPremiumTransaction || false
      };
    } else {
      // Calculate fresh pricing (for new transactions)
      pricing = calculateRentalPricing(
        transaction.item ? transaction.item.price : 0,
        transaction.requestedFrom,
        transaction.requestedTo,
        transaction.borrower
      );
      lendingFee = pricing.finalPrice;
      totalAmount = parseFloat((lendingFee + deposit).toFixed(2));
    }

    const summary = {
      id: transaction._id,
      borrower: transaction.borrower ? (transaction.borrower.firstName + ' ' + transaction.borrower.lastName) : 'Unknown Borrower', 
      itemTitle: transaction.item ? transaction.item.title : 'Unknown Item',
      itemPrice: transaction.item ? transaction.item.price : 0, // Weekly rate
      deposit: deposit,
      totalAmount: totalAmount,
      lendingFee: lendingFee,
      lender: transaction.lender ? (transaction.lender.firstName + ' ' + transaction.lender.lastName) : 'Unknown Lender',
      status: transaction.status,
      requestDate: transaction.requestDate,
      requestedFrom: transaction.requestedFrom,
      requestedTo: transaction.requestedTo
    };

    // Add premium discount info if applicable
    if (pricing.discountRate > 0) {
      summary.premiumDiscount = {
        originalAmount: pricing.originalPrice,
        discountRate: pricing.discountRate,
        discountAmount: pricing.discountAmount,
        finalAmount: pricing.finalPrice
      };
    }
  
    // Return the summary
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transaction summary.' });
  }
}

// Update transaction status after payment completion
export async function completePayment(req, res) {
  try {
    // Check if user is authenticated
    if (!req.userId) {
      return res.status(401).json({ error: 'Authentication required to complete payment.' });
    }

    const transaction = await Transaction.findById(req.params.id)
      .populate('item')
      .populate('borrower', 'premiumStatus'); // Populate borrower to get premium status
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    if (transaction.borrower._id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Only the borrower can complete payment.' });
    }

    // Calculate financial details for payment completion with premium discount
    const deposit = transaction.item.price * 5;
    const pricing = calculateRentalPricing(
      transaction.item.price,
      transaction.requestedFrom, 
      transaction.requestedTo, 
      transaction.borrower
    );
    
    const lendingFee = pricing.finalPrice;
    const totalAmount = parseFloat((lendingFee + deposit).toFixed(2));
    const platformFee = calculatePlatformFee(lendingFee);

    // Update transaction with financial details and status
    transaction.status = 'paid';
    transaction.deposit = deposit;
    transaction.totalAmount = totalAmount;
    
    // Store pricing information for future reference
    transaction.finalLendingFee = lendingFee; // The actual fee after discounts
    transaction.originalLendingFee = pricing.originalPrice; // Original price before discount
    transaction.discountApplied = pricing.discountAmount; // How much discount was applied
    transaction.discountRate = pricing.discountRate; // Discount percentage
    transaction.isPremiumTransaction = pricing.isPremium; // Was premium discount applied
    
    await transaction.save();
    
    const response = { 
      message: 'Payment completed successfully', 
      status: 'paid',
      deposit: deposit,
      totalAmount: totalAmount,
      lendingFee: lendingFee,
      platformFee: platformFee,
      paymentFlow: {
        borrowerPaid: totalAmount,
        platformKeeps: platformFee,
        willReleaseToLender: calculateLenderPayment(lendingFee),
        depositHeld: deposit
      }
    };

    // Add premium discount info if applicable
    if (pricing.discountRate > 0) {
      response.premiumDiscount = {
        originalAmount: pricing.originalPrice,
        discountRate: pricing.discountRate,
        discountAmount: pricing.discountAmount,
        finalAmount: pricing.finalPrice
      };
    }
    
    res.json(response);
  } catch (err) {
    console.error('Error completing payment:', err);
    res.status(500).json({ error: 'Failed to complete payment' });
  }
}

export async function completeTransaction(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    
    // Only borrower can mark as completed (Do we want to keep it like this or change it to lender?)
    // My thinking was, that this way the borrower will be more likely to return the item on time as he will not get his deposit back if he does not return the item on time.
    if (transaction.borrower.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    transaction.status = 'returned';
    transaction.returnDate = new Date();
    await transaction.save();

    if (transaction.item) {
      transaction.item.status = 'available';
      await transaction.item.save();
    }

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete transaction.' });
  }
}

// Lender or borrower proposes renegotiation
export async function renegotiateTransaction(req, res) {
  const { from, to, message } = req.body || {};
  if (!from || !to) {
    return res.status(400).json({ error: 'Missing from/to in request body.' });
  }
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Only lender or borrower can renegotiate
    const userId = req.userId?.toString();
    if (
      transaction.lender?.toString() !== userId &&
      transaction.borrower?.toString() !== userId
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    transaction.status = 'renegotiation_requested';
    transaction.renegotiation = { from, to, message };
    await transaction.save();
    res.json(transaction);
  } catch (err) {
    console.error('Renegotiation error:', err);
    res.status(500).json({ error: 'Failed to renegotiate transaction.' });
  }
}

export async function acceptRenegotiation(req, res) {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Only borrower can accept
    if (transaction.borrower.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    transaction.status = 'accepted';
    transaction.requestedFrom = transaction.renegotiation.from;
    transaction.requestedTo = transaction.renegotiation.to;
    transaction.renegotiation = undefined;
    await transaction.save();
    res.json(transaction);
  } catch (err) {
    console.error('Accept renegotiation error:', err);
    res.status(500).json({ error: 'Failed to accept renegotiation.' });
  }
}

export async function declineRenegotiation(req, res) {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Only borrower can decline
    if (transaction.borrower.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    transaction.status = 'rejected';
    transaction.borrowerMessage = message;
    await transaction.save();
    res.json(transaction);
  } catch (err) {
    console.error('Decline renegotiation error:', err);
    res.status(500).json({ error: 'Failed to decline renegotiation.' });
  }
}

// Edit transaction (borrower can change time/message if not completed/returned/rejected)
export const editTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { requestedFrom, requestedTo, message } = req.body;
    const transaction = await Transaction.findById(id);

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.borrower.toString() !== req.userId)
      return res.status(403).json({ error: 'Not authorized' });
    if (['returned', 'completed', 'rejected', 'retracted'].includes(transaction.status))
      return res.status(400).json({ error: 'Cannot edit this transaction' });

    transaction.requestedFrom = requestedFrom;
    transaction.requestedTo = requestedTo;
    if (message !== undefined) transaction.message = message;
    await transaction.save();

    res.json(transaction);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Retract transaction (borrower can retract if not completed/returned/rejected)
export const retractTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);

    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.borrower.toString() !== req.userId)
      return res.status(403).json({ error: 'Not authorized' });
    if (['returned', 'completed', 'rejected'].includes(transaction.status))
      return res.status(400).json({ error: 'Cannot retract this transaction' });

    transaction.status = 'retracted';
    await transaction.save();

    res.json({ message: 'Transaction retracted', transaction });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// Generate return code for a transaction
export const generateReturnCode = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId; // FIXED
  const tx = await Transaction.findById(id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.lender.toString() !== userId) return res.status(403).json({ error: 'Not authorized' });
  if (tx.status !== 'borrowed') return res.status(400).json({ error: 'Not in borrowed state' });

  // Generate code if not already generated
  if (!tx.returnCodeGenerated) {
    tx.returnCode = crypto.randomBytes(3).toString('hex').toUpperCase(); // e.g. "A1B2C3"
    tx.returnCodeGenerated = true;
    await tx.save();
  }
  res.json({ code: tx.returnCode });
};

// Submit return code to complete the transaction
export const submitReturnCode = async (req, res) => {
  const { id } = req.params;
  const { code } = req.body;
  const userId = req.userId; // FIXED
  const tx = await Transaction.findById(id).populate('item', 'title');
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.borrower.toString() !== userId) return res.status(403).json({ error: 'Not authorized' });
  if (tx.status !== 'borrowed') return res.status(400).json({ error: 'Not in borrowed state' });

  if (!tx.returnCodeGenerated || !tx.returnCode) {
    return res.status(400).json({ error: 'Return code not generated yet.' });
  }
  if (tx.returnCodeUsed) {
    return res.status(400).json({ error: 'Return code already used.' });
  }
  if (tx.returnCode !== code) {
    return res.status(400).json({ error: 'Incorrect code.' });
  }

  // Calculate deposit distribution based on damage
  const damageRefundPercentage = tx.damageRefundPercentage || 100; // Default: 100% refund to borrower
  const depositToBorrower = tx.deposit * (damageRefundPercentage / 100); // Refund to borrower
  const depositToLender = tx.deposit * ((100 - damageRefundPercentage) / 100); // Damage compensation to lender
  
  // Don't transfer deposit yet - wait for lender to inspect and confirm/report damage
  
  tx.status = 'returned';
  tx.returnCodeUsed = true;
  // depositReturned will be set to true when damage is processed or confirmed as none
  await tx.save();
  
  res.json({ 
    success: true,
    message: 'Item returned successfully. Lender can now inspect for damage or fully refund the deposit.',
    awaitingDamageInspection: true,
    // Don't include depositDistribution yet - will be available after damage inspection
  });
};

export const forceCompleteReturn = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId; // FIXED
  const tx = await Transaction.findById(id).populate('item', 'title');
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.lender.toString() !== userId) return res.status(403).json({ error: 'Not authorized' });
  if (tx.status !== 'borrowed') return res.status(400).json({ error: 'Not in borrowed state' });

  // Force return only changes status to 'returned' - no immediate deposit distribution
  // Lender can then inspect and report damage or confirm no damage as usual
  
  tx.status = 'returned';
  tx.returnCodeUsed = true; // Mark as if code was used
  // depositReturned stays false - will be set after damage inspection
  await tx.save();
  
  res.json({ 
    success: true,
    message: 'Force return executed. Item marked as returned. You can now inspect for damage or fully refund the deposit.',
    awaitingDamageInspection: true
  });
};

// Generate pickup code for a transaction
export async function generatePickupCode(req, res) {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id);
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Only borrower can generate after payment
    if (transaction.borrower.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    // If code already exists, return it
    if (transaction.pickupCode) {
      return res.json({ code: transaction.pickupCode });
    }
    // Only if status is 'accepted' or 'paid'
    if (!['accepted', 'paid', 'borrowed'].includes(transaction.status)) {
      return res.status(400).json({ error: 'Cannot generate code at this stage.' });
    }

    // Generate a 6-character hex code (like return code)
    const code = crypto.randomBytes(3).toString('hex').toUpperCase();
    transaction.pickupCode = code;
    await transaction.save();
    res.json({ code });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate pickup code.' });
  }
}

export async function usePickupCode(req, res) {
  try {
    const { id } = req.params;
    const { code } = req.body;
    const transaction = await Transaction.findById(id).populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });

    // Only lender can use the code
    if (transaction.lender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    if (transaction.pickupCodeUsed) {
      return res.status(400).json({ error: 'Code already used.' });
    }
    if (transaction.pickupCode !== code) {
      return res.status(400).json({ error: 'Incorrect code.' });
    }

    // Calculate payments - use original lending fee (before discounts) for lender payment
    const finalLendingFee = transaction.finalLendingFee || (transaction.totalAmount - transaction.deposit);
    const originalLendingFee = transaction.originalLendingFee || finalLendingFee;
    const paymentToLender = calculateLenderPayment(originalLendingFee);
    const platformFee = calculatePlatformFee(finalLendingFee);
    
    // Perform PayPal transfer to lender (95% of lending fee) - Fixed Sandbox Account
    const transferResult = await mockPayPalTransfer(
      SANDBOX_ACCOUNTS.LOCALLOOP,
      SANDBOX_ACCOUNTS.LENDER,
      paymentToLender,
      `Lending payment for rental item - Period: ${new Date(transaction.requestedFrom).toLocaleDateString()} to ${new Date(transaction.requestedTo).toLocaleDateString()}`
    );
    
    // Mark as borrowed and update payment tracking
    transaction.status = 'borrowed';
    transaction.pickupCodeUsed = true;
    transaction.pickupCode = undefined;
    transaction.paymentToLenderReleased = true;
    
    if (transaction.item) {
      transaction.item.status = 'lent';
      await transaction.item.save();
    }
    await transaction.save();
    
    // Fetch and return the updated transaction with populated fields
    const updatedTransaction = await Transaction.findById(id)
      .populate('item')
      .populate('borrower')
      .populate('lender');
    
    res.json(updatedTransaction);
  } catch (err) {
    console.error('Error in usePickupCode:', err);
    res.status(500).json({ error: 'Failed to use pickup code.' });
  }
}

// Force pickup for a transaction (bypassing code)
export async function forcePickup(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.status !== 'paid') return res.status(400).json({ error: 'Cannot force pickup at this stage.' });
    if (transaction.borrower.toString() !== req.userId) return res.status(403).json({ error: 'Not authorized.' });

    // Calculate payments - use original lending fee (before discounts) for lender payment
    const finalLendingFee = transaction.finalLendingFee || (transaction.totalAmount - transaction.deposit);
    const originalLendingFee = transaction.originalLendingFee || finalLendingFee;
    const paymentToLender = calculateLenderPayment(originalLendingFee);
    const platformFee = calculatePlatformFee(finalLendingFee);
    
    // Perform PayPal transfer to lender - Fixed Sandbox Account
    const transferResult = await mockPayPalTransfer(
      SANDBOX_ACCOUNTS.LOCALLOOP,
      SANDBOX_ACCOUNTS.LENDER,
      paymentToLender,
      `Force pickup payment for rental item - Period: ${new Date(transaction.requestedFrom).toLocaleDateString()} to ${new Date(transaction.requestedTo).toLocaleDateString()}`
    );
    
    transaction.status = 'borrowed';
    transaction.pickupCodeUsed = true;
    transaction.paymentToLenderReleased = true;

    if (transaction.item) {
      transaction.item.status = 'lent';
      await transaction.item.save();
    }
    await transaction.save();
    
    // Fetch and return the updated transaction with populated fields
    const updatedTransaction = await Transaction.findById(req.params.id)
      .populate('item')
      .populate('borrower')
      .populate('lender');
    
    res.json(updatedTransaction);
  } catch (err) {
    console.error('Error in forcePickup:', err);
    res.status(500).json({ error: 'Failed to force pickup' });
  }
}

// Report damage for a transaction (lender only)
export const reportDamage = async (req, res) => {
  try {
    const { id } = req.params;
    const { damageDescription, depositRefundPercentage } = req.body;
    const userId = req.userId;
    
    const transaction = await Transaction.findById(id).populate('item', 'title').populate('lender', 'email');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.lender._id.toString() !== userId) return res.status(403).json({ error: 'Only lender can report damage' });
    if (!['borrowed', 'returned'].includes(transaction.status)) return res.status(400).json({ error: 'Can only report damage for borrowed or returned items' });
    if (transaction.depositReturned) return res.status(400).json({ error: 'Cannot report damage after deposit has been returned' });
    
    // Validate damage percentage
    if (depositRefundPercentage < 0 || depositRefundPercentage > 100) {
      return res.status(400).json({ error: 'Damage percentage must be between 0 and 100' });
    }
    
    transaction.damageReported = true;
    transaction.damageDescription = damageDescription;
    transaction.depositRefundPercentage = depositRefundPercentage;
    
    // Now process the deposit transfers based on damage assessment
    const depositToBorrower = transaction.deposit * (depositRefundPercentage / 100);
    const depositToLender = transaction.deposit * ((100 - depositRefundPercentage) / 100);
    
    // Transfer damage compensation to lender if applicable - Fixed Sandbox Account
    if (depositToLender > 0) {
      const lenderTransfer = await mockPayPalTransfer(
        SANDBOX_ACCOUNTS.LOCALLOOP,
        SANDBOX_ACCOUNTS.LENDER,
        depositToLender,
        `Damage compensation for "${transaction.item.title}" - Borrower gets ${depositRefundPercentage}% refund`
      );
    }
    
    // Refund remaining deposit to borrower - Fixed Sandbox Account
    if (depositToBorrower > 0) {
      const borrowerTransfer = await mockPayPalTransfer(
        SANDBOX_ACCOUNTS.LOCALLOOP,
        SANDBOX_ACCOUNTS.BORROWER,
        depositToBorrower,
        `Deposit refund for "${transaction.item.title}" - ${depositRefundPercentage}% refund`
      );
    }
     transaction.depositReturned = true;
    transaction.status = 'completed'; // Transaction completely finished after deposit resolution
    await transaction.save();
    
    res.json({
      success: true,
      message: 'Damage reported and deposit processed successfully',
      damageReport: {
        description: damageDescription,
        damageRefundPercentage: depositRefundPercentage,
        lenderCompensationPercentage: 100 - depositRefundPercentage,
        refundAmount: depositToBorrower,
        compensationAmount: depositToLender
      },
      depositDistribution: {
        toLender: depositToLender,
        toBorrower: depositToBorrower,
        damageRefundPercentage: depositRefundPercentage
      }
    });
  } catch (err) {
    console.error('Error reporting damage:', err);
    res.status(500).json({ error: 'Failed to report damage' });
  }
};

// Get transaction financial summary (for admins/debugging)
export const getTransactionFinancials = async (req, res) => {
  try {
    const { id } = req.params;
    const transaction = await Transaction.findById(id)
      .populate('item', 'title price')
      .populate('lender', 'email')
      .populate('borrower', 'email');
    
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    
    // Check if user is involved in transaction
    const userId = req.userId;
    if (transaction.lender._id.toString() !== userId && transaction.borrower._id.toString() !== userId) {
      return res.status(403).json({ error: 'Not authorized to view financials' });
    }
    
    const finalLendingFee = transaction.finalLendingFee || (transaction.totalAmount - transaction.deposit);
    const originalLendingFee = transaction.originalLendingFee || finalLendingFee;
    const platformFee = calculatePlatformFee(finalLendingFee);
    const lenderPayment = calculateLenderPayment(originalLendingFee);
    
    const financials = {
      transactionId: transaction._id,
      status: transaction.status,
      itemTitle: transaction.item.title,
      
      // Original payment from borrower
      totalPaidByBorrower: transaction.totalAmount,
      lendingFee: finalLendingFee,
      originalLendingFee: originalLendingFee,
      deposit: transaction.deposit,
      
      // Platform distribution (calculated)
      // Note: Platform fee is 5% of final lending fee (after discount)
      // Lender payment is 95% of original lending fee (before discount)
      platformFeeAmount: platformFee,
      lenderPaymentAmount: lenderPayment,
      
      // Payment status
      paymentToLenderReleased: transaction.paymentToLenderReleased,
      
      // Deposit handling
      depositReturned: transaction.depositReturned,
      damageReported: transaction.damageReported,
      damageDescription: transaction.damageDescription,
      depositRefundPercentage: transaction.depositRefundPercentage
    };
    
    res.json(financials);
  } catch (err) {
    console.error('Error getting transaction financials:', err);
    res.status(500).json({ error: 'Failed to get transaction financials' });
  }
};

// Confirm no damage and process full deposit refund
export const confirmNoDamage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;
    
    const transaction = await Transaction.findById(id).populate('item', 'title');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.lender._id.toString() !== userId) return res.status(403).json({ error: 'Only lender can confirm no damage' });
    if (!['returned'].includes(transaction.status)) return res.status(400).json({ error: 'Can only confirm no damage for returned transactions' });
    if (transaction.depositReturned) return res.status(400).json({ error: 'Deposit already processed' });
    if (transaction.damageReported) return res.status(400).json({ error: 'Damage already reported' });
    
    // Process full deposit refund (100% to borrower)
    const depositToBorrower = transaction.deposit;
    const depositToLender = 0;
    
    // Transfer full deposit back to borrower - Fixed Sandbox Account
    const borrowerTransfer = await mockPayPalTransfer(
      SANDBOX_ACCOUNTS.LOCALLOOP,
      SANDBOX_ACCOUNTS.BORROWER,
      depositToBorrower,
      `Full deposit refund for "${transaction.item.title}" - No damage reported`
    );
    
    transaction.depositRefundPercentage = 100; // No damage = 100% refund
    transaction.depositReturned = true;
    transaction.status = 'completed'; // Transaction completely finished after deposit resolution
    await transaction.save();
    
    res.json({
      success: true,
      message: 'No damage confirmed and deposit refunded successfully',
      depositDistribution: {
        toLender: depositToLender,
        toBorrower: depositToBorrower,
        damageRefundPercentage: 100
      }
    });
  } catch (err) {
    console.error('Error confirming no damage:', err);
    res.status(500).json({ error: 'Failed to confirm no damage' });
  }
};

