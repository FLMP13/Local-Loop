import Transaction from '../models/transaction.js';
import Item from '../models/item.js';

// Request to borrow/lend an item
export async function requestLend(req, res) {
  try {
    const { itemId, requestedFrom, requestedTo } = req.body;
    const from = new Date(requestedFrom);
    const to = new Date(requestedTo);
    if (to < from) return res.status(400).json({ error: 'Invalid date range.' });

    const item = await Item.findById(itemId);
    if (!item) return res.status(404).json({ error: 'Item not found.' });

    // check requested range inside any availability block
    const ok = item.availability?.some(
      ({ from: a, to: b }) => from >= new Date(a) && to <= new Date(b)
    );
    if (!ok) {
      return res.status(400).json({ error: 'Requested dates not available.' });
    }

    // Create the transaction with status 'requested' 
    const txn = await Transaction.create({
      item: itemId,
      lender: item.owner,
      borrower: req.userId,
      requestedFrom: from,
      requestedTo: to
    });
    item.status = 'requested';
    await item.save();
    res.status(201).json(txn);

  } catch (err) {
    console.error('requestLend error:', err);
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