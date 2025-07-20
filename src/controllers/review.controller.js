import Review from '../models/review.js';
import Transaction from '../models/transaction.js';
import User from '../models/user.js';

// Create a review
export async function createReview(req, res) {
  try {
    const { transactionId, rating, comment } = req.body;
    
    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Rating must be between 1 and 5' });
    }

    // Find transaction and verify it's completed
    const transaction = await Transaction.findById(transactionId)
      .populate('lender borrower');
    
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'completed') {
      return res.status(400).json({ error: 'Transaction must be completed to leave a review' });
    }

    // Determine reviewer role and reviewee
    let reviewerRole, revieweeId;
    if (transaction.lender._id.toString() === req.userId) {
      reviewerRole = 'lender';
      revieweeId = transaction.borrower._id;
      
      if (transaction.lenderReviewed) {
        return res.status(400).json({ error: 'You have already reviewed this transaction' });
      }
    } else if (transaction.borrower._id.toString() === req.userId) {
      reviewerRole = 'borrower';
      revieweeId = transaction.lender._id;
      
      if (transaction.borrowerReviewed) {
        return res.status(400).json({ error: 'You have already reviewed this transaction' });
      }
    } else {
      return res.status(403).json({ error: 'You are not authorized to review this transaction' });
    }

    // Create review
    const review = await Review.create({
      transaction: transactionId,
      reviewer: req.userId,
      reviewee: revieweeId,
      reviewerRole,
      rating,
      comment
    });

    // Update transaction review status
    if (reviewerRole === 'lender') {
      transaction.lenderReviewed = true;
    } else {
      transaction.borrowerReviewed = true;
    }
    await transaction.save();

    // Update reviewee's rating
    await updateUserRating(revieweeId, reviewerRole === 'lender' ? 'borrower' : 'lender', rating);

    res.status(201).json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create review' });
  }
}

// Get reviews for a user
export async function getUserReviews(req, res) {
  try {
    const { userId } = req.params;
    const { role } = req.query; // 'lender' or 'borrower'
    
    const filter = { reviewee: userId };
    if (role) {
      // If role is specified, get reviews where the user was reviewed in that role
      filter.reviewerRole = role === 'lender' ? 'borrower' : 'lender';
    }

    const reviews = await Review.find(filter)
      .populate('reviewer', 'nickname firstName lastName')
      .populate({
        path: 'transaction',
        populate: {
          path: 'item',
          select: 'title'
        }
      })
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
}

// Check if user can review a transaction
export async function canReviewTransaction(req, res) {
  try {
    const { transactionId } = req.params;
    
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    if (transaction.status !== 'completed') {
      return res.json({ canReview: false, reason: 'Transaction not completed' });
    }

    let canReview = false;
    let role = null;

    // Check if the user is the lender or borrower and if they have not reviewed yet
    if (transaction.lender.toString() === req.userId && !transaction.lenderReviewed) {
      canReview = true;
      role = 'lender';
    } else if (transaction.borrower.toString() === req.userId && !transaction.borrowerReviewed) {
      canReview = true;
      role = 'borrower';
    }

    res.json({ canReview, role });
  } catch (err) {
    res.status(500).json({ error: 'Failed to check review status' });
  }
}

// Helper function to update user rating
async function updateUserRating(userId, ratingType, newRating) {
  const user = await User.findById(userId);
  if (!user) return;

  const currentRating = ratingType === 'lender' ? user.lenderRating : user.borrowerRating;
  const newCount = currentRating.count + 1;
  const newAverage = ((currentRating.average * currentRating.count) + newRating) / newCount;

  if (ratingType === 'lender') {
    user.lenderRating = { average: newAverage, count: newCount };
  } else {
    user.borrowerRating = { average: newAverage, count: newCount };
  }

  await user.save();
}