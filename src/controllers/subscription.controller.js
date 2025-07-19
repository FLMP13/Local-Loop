// Backend/src/controllers/subscription.controller.js
// Dedicated controller for subscription management

import Subscription from '../models/subscription.js';
import User from '../models/user.js';
import { isPremiumUser } from '../utils/premiumUtils.js';

// Get current user's subscription details
export async function getCurrentSubscription(req, res) {
  try {
    const subscription = await Subscription.findOne({
      user: req.userId,
      status: { $in: ['active', 'cancelled'] }
    }).sort({ createdAt: -1 });

    // If no subscription found, return appropriate message
    if (!subscription) {
      return res.json({
        hasSubscription: false,
        message: 'No active subscription found'
      });
    }

    res.json({
      hasSubscription: true,
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextBillingDate: subscription.nextBillingDate,
        cancelledAt: subscription.cancelledAt,
        cancellationReason: subscription.cancellationReason,
        autoRenew: subscription.autoRenew,
        isActive: subscription.isActive(),
        isExpired: subscription.isExpired()
      }
    });
  } catch (error) {
    console.error('getCurrentSubscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Get user's subscription history
 
export async function getSubscriptionHistory(req, res) {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Fetch subscriptions for the current user
    const subscriptions = await Subscription.find({ user: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalSubscriptions = await Subscription.countDocuments({ user: req.userId });

    res.json({
      subscriptions: subscriptions.map(sub => ({
        id: sub._id,
        plan: sub.plan,
        status: sub.status,
        startDate: sub.startDate,
        endDate: sub.endDate,
        cancelledAt: sub.cancelledAt,
        cancellationReason: sub.cancellationReason,
        createdAt: sub.createdAt
      })),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(totalSubscriptions / limit),
        total: totalSubscriptions
      }
    });
  } catch (error) {
    console.error('getSubscriptionHistory error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Create new subscription (used by premium upgrade)
export async function createSubscription(req, res) {
  try {
    const { plan = 'monthly', paypalSubscriptionId } = req.body;
    
    if (!['monthly', 'yearly'].includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan type' });
    }
    
    // Check if user exists
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user already has active subscription
    const existingSubscription = await Subscription.findOne({
      user: req.userId,
      status: 'active'
    });

    if (existingSubscription) {
      return res.status(409).json({ 
        error: 'User already has an active subscription',
        subscription: existingSubscription
      });
    }

    // Calculate dates
    const now = new Date();
    const endDate = new Date(now);
    const nextBillingDate = new Date(now);
    
    if (plan === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
      nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
    }

    // Create subscription record
    const subscription = new Subscription({
      user: req.userId,
      plan,
      status: 'active',
      paypalSubscriptionId,
      startDate: now,
      endDate,
      nextBillingDate
    });

    await subscription.save();

    // Update user premium status
    user.premiumStatus = 'active';
    await user.save();

    res.status(201).json({
      message: 'Subscription created successfully',
      subscription: {
        id: subscription._id,
        plan: subscription.plan,
        status: subscription.status,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        nextBillingDate: subscription.nextBillingDate
      },
      user: {
        premiumStatus: user.premiumStatus
      }
    });
  } catch (error) {
    console.error('createSubscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Cancel subscription
export async function cancelSubscription(req, res) {
  try {
    const { reason = '' } = req.body;
    
    // Check if user exists
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check if user has an active subscription
    const subscription = await Subscription.findOne({
      user: req.userId,
      status: 'active'
    });

    if (!subscription) {
      return res.status(400).json({ error: 'No active subscription found' });
    }

    // Cancel subscription - set autoRenew to false
    subscription.status = 'cancelled';
    subscription.autoRenew = false;
    subscription.cancelledAt = new Date();
    subscription.cancellationReason = reason;
    await subscription.save();

    // User stays premium until endDate, background job will handle expiration

    res.json({
      message: `Auto-renewal cancelled. Premium benefits will continue until ${subscription.endDate.toISOString().split('T')[0]}`,
      subscription: {
        id: subscription._id,
        status: subscription.status,
        autoRenew: subscription.autoRenew,
        cancelledAt: subscription.cancelledAt,
        endDate: subscription.endDate,
        cancellationReason: subscription.cancellationReason
      }
    });
  } catch (error) {
    console.error('cancelSubscription error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}

// Check for renewal notifications and mark as shown
export async function checkRenewalNotifications(req, res) {
  try {
    const subscription = await Subscription.findOne({
      user: req.userId,
      status: 'active',
      lastRenewalDate: { $exists: true },
      renewalNotificationShown: false
    }).sort({ createdAt: -1 });

    if (!subscription) {
      return res.json({
        hasNotification: false
      });
    }

    // Calculate how many days ago the renewal happened
    const renewalDate = subscription.lastRenewalDate;
    const daysSinceRenewal = Math.floor((new Date() - renewalDate) / (24 * 60 * 60 * 1000));

    // Only show notification if renewal was recent (within 7 days)
    if (daysSinceRenewal <= 7) {
      // Mark notification as shown
      subscription.renewalNotificationShown = true;
      await subscription.save();

      return res.json({
        hasNotification: true,
        notification: {
          type: 'renewal_success',
          message: `Your ${subscription.plan} premium subscription has been automatically renewed. Thank you for your continued support!`,
          renewalDate: renewalDate,
          newEndDate: subscription.endDate,
          plan: subscription.plan
        }
      });
    }

    res.json({
      hasNotification: false
    });

  } catch (error) {
    console.error('checkRenewalNotifications error:', error);
    res.status(500).json({ error: 'Server error' });
  }
}
