import Transaction from '../models/transaction.js';
import Item from '../models/item.js';
import crypto from 'crypto';

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
      .populate('borrower', 'nickname email');
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch borrowings.' });
  }
}

// Get all transactions where user is lender
export async function getMyLendings(req, res) {
  try {
    const transactions = await Transaction.find({ lender: req.userId })
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'nickname email' }
      })
      .populate('borrower', 'nickname email')
      .populate('lender', 'nickname email'); 
    res.json(transactions);
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

// Accept a transaction request and set item status to 'lent' and transaction status to 'accepted'
export async function acceptTransaction(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    if (transaction.lender.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    transaction.status = 'accepted';
    await transaction.save();

    if (transaction.item) {
      transaction.item.status = 'lent';
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

export async function completeTransaction(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('item');
    if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
    
    // Only borrower can mark as completed (Do we want to keep it like this or change it to lender?)
    // My thinking was, that this way the borrower will be more likely to return the item on time as he will not get his deposit back if he does not return the item on time.
    if (transaction.borrower.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    transaction.status = 'completed';
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
  try {
    const { id } = req.params;
    const { from, to, message } = req.body;
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
    if (['completed', 'returned', 'rejected', 'retracted'].includes(transaction.status))
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
    if (['completed', 'returned', 'rejected'].includes(transaction.status))
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
  const tx = await Transaction.findById(id);
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

  tx.status = 'completed';
  tx.returnCodeUsed = true;
  await tx.save();
  res.json({ success: true });
};

export const forceCompleteReturn = async (req, res) => {
  const { id } = req.params;
  const userId = req.userId; // FIXED
  const tx = await Transaction.findById(id);
  if (!tx) return res.status(404).json({ error: 'Transaction not found' });
  if (tx.lender.toString() !== userId) return res.status(403).json({ error: 'Not authorized' });
  if (tx.status !== 'borrowed') return res.status(400).json({ error: 'Not in borrowed state' });

  tx.status = 'completed';
  tx.returnCodeUsed = true;
  await tx.save();
  res.json({ success: true });
};