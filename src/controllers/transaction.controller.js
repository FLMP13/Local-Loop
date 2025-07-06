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