// \Backend\src\controllers\user.controller.js
// Import user model and necessary libraries
import User from '../models/user.js';
import Subscription from '../models/subscription.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { isPremiumUser, getMaxListings, getUserDiscountRate } from '../utils/premiumUtils.js';

// Function to get the currently logged-in user's details
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Function to get the avatar of the currently logged-in user
export async function getAvatar(req, res) {
  try {
    const user = await User.findById(req.userId).select('profilePic');
    if (!user || !user.profilePic) return res.status(404).end();

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'profilePics'
    });
    const stream = bucket.openDownloadStream(user.profilePic);
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  } catch (err) {
    console.error('getAvatar error:', err);
    res.status(500).end();
  }
}

// Function to update the currently logged-in user's details
export async function updateMe(req, res) {
  try {
    const updates = {};
    for (let field of ['nickname','email','zipCode','bio']) {
      if (req.body[field] != null) updates[field] = req.body[field];
    }
    if (req.file?.id) updates.profilePic = req.file.id;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash -__v');

    res.json(user);
  } catch (err) {
    console.error('updateMe error:', err);
    res.status(400).json({ error: err.message });
  }
}

// Function to change the password of the currently logged-in user
export async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Both old and new passwords required' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Old password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Function to get the current user's premium status and limits
export async function getPremiumStatus(req, res) {
  try {
    const user = await User.findById(req.userId).select('premiumStatus');
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Get active subscription details
    const subscription = await Subscription.findOne({
      user: req.userId,
      status: 'active'
    });

    const isPremium = isPremiumUser(user);
    const maxListings = getMaxListings(user);
    const discountRate = getUserDiscountRate(user);

    res.json({
      isPremium,
      premiumStatus: user.premiumStatus,
      subscription: subscription ? {
        plan: subscription.plan,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextBillingDate: subscription.nextBillingDate,
        paypalSubscriptionId: subscription.paypalSubscriptionId
      } : null,
      maxListings,
      discountRate
    });
  } catch (err) {
    console.error('getPremiumStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Function to upgrade user to premium (redirects to subscription controller)
export async function upgradeToPremium(req, res) {
  // This function is kept for backward compatibility
  // New implementations should use /api/subscriptions/create
  try {
    const { createSubscription } = await import('./subscription.controller.js');
    await createSubscription(req, res);
  } catch (err) {
    console.error('upgradeToPremium error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Function to cancel premium subscription (redirects to subscription controller)
export async function cancelPremium(req, res) {
  // This function is kept for backward compatibility
  // New implementations should use /api/subscriptions/cancel
  try {
    const { cancelSubscription } = await import('./subscription.controller.js');
    await cancelSubscription(req, res);
  } catch (err) {
    console.error('cancelPremium error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Function to set premium status (for testing/admin)
export async function setPremiumStatus(req, res) {
  try {
    const { premiumStatus } = req.body;
    
    if (!['active', 'inactive', 'cancelled'].includes(premiumStatus)) {
      return res.status(400).json({ error: 'Invalid premium status' });
    }
    
    const user = await User.findByIdAndUpdate(
      req.userId,
      { 
        $set: { 
          premiumStatus: premiumStatus,
          premiumStartDate: premiumStatus === 'active' ? new Date() : undefined,
          premiumEndDate: premiumStatus === 'active' ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined // 30 days from now
        }
      },
      { new: true, select: '-passwordHash -__v' }
    );
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (err) {
    console.error('setPremiumStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}