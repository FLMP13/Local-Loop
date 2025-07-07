import Transaction from '../models/transaction.js';
import Item from '../models/item.js';

// Request to borrow/lend an item
export async function requestLend(req, res) {
  try {
    const { itemId } = req.body;
    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Prevent owner from requesting their own item
    if (item.owner.toString() === req.userId) {
      return res.status(400).json({ error: 'You cannot request your own item.' });
    }

    // Optionally: Check if a pending transaction already exists
    const existing = await Transaction.findOne({ item: itemId, borrower: req.userId, status: 'requested' });
    if (existing) {
      return res.status(400).json({ error: 'You have already requested this item.' });
    }

    const transaction = await Transaction.create({
      item: itemId,
      lender: item.owner,
      borrower: req.userId,
      status: 'requested'
    });

    // Update item status to 'requested'
    item.status = 'requested';
    await item.save();

    res.status(201).json(transaction);
  } catch (err) {
    console.error(err);
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
      .populate('borrower', 'firstName lastName');

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    //Has each user access to the transaction
    if (transaction.lender._id.toString() !== req.userId && transaction.borrower._id.toString() !== req.userId) {
      return res.status(403).json({ error: 'Not authorized to view this transaction.' });
    }

    // Debug: Log the populated data
    console.log('Transaction lender:', transaction.lender);
    console.log('Transaction borrower:', transaction.borrower);
    console.log('Transaction item:', transaction.item);

    const summary = {
      id: transaction._id,
      borrower: transaction.borrower ? (transaction.borrower.firstName + ' ' + transaction.borrower.lastName) : 'Unknown Borrower', 
      itemTitle: transaction.item ? transaction.item.title : 'Unknown Item',
      itemPrice: transaction.item ? transaction.item.price : 0,
      lender: transaction.lender ? (transaction.lender.firstName + ' ' + transaction.lender.lastName) : 'Unknown Lender',
      status: transaction.status,
      requestDate: transaction.requestDate
    };
  
    // Return the summary
    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch transaction summary.' });
  }
}

// Update transaction status after payment completion
export async function completePayment(req, res) {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('item');
    
    if (!transaction || transaction.borrower.toString() !== req.userId) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    transaction.status = 'borrowed';
    await transaction.save();

    if (transaction.item) {
      transaction.item.status = 'borrowed';
      await transaction.item.save();
    }

    res.json({ message: 'Payment completed', status: 'borrowed' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to complete payment' });
  }
}