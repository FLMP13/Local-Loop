// Background job to manage subscription statuses
// This should run daily via cron job or similar

import mongoose from 'mongoose';
import User from '../models/user.js';
import Subscription from '../models/subscription.js';

export async function updateSubscriptionStatuses() {
  try {
    console.log('Starting subscription status update...');

    // Calculate today at end of day (23:59:59)
    const now = new Date();
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    console.log(`Checking for subscriptions expired before: ${todayEnd.toISOString()}`);

    // Find subscriptions that have expired (including today)
    const expiredSubscriptions = await Subscription.find({
      status: { $in: ['active', 'cancelled'] },
      endDate: { $lt: todayEnd }
    });

    console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);

    let renewed = 0;
    let expired = 0;

    for (const subscription of expiredSubscriptions) {
      try {
        // Check if subscription should auto-renew
        if (subscription.status === 'active' && subscription.autoRenew) {
          console.log(`🔄 Auto-renewing subscription ${subscription._id}`);
          
          // Calculate new dates
          const newStartDate = subscription.endDate;
          const newEndDate = new Date(newStartDate);
          const newBillingDate = new Date(newStartDate);
          
          if (subscription.plan === 'yearly') {
            newEndDate.setFullYear(newEndDate.getFullYear() + 1);
            newBillingDate.setFullYear(newBillingDate.getFullYear() + 1);
          } else {
            newEndDate.setMonth(newEndDate.getMonth() + 1);
            newBillingDate.setMonth(newBillingDate.getMonth() + 1);
          }

          // Create new subscription record for the next period
          const newSubscription = new Subscription({
            user: subscription.user,
            plan: subscription.plan,
            status: 'active',
            paypalSubscriptionId: subscription.paypalSubscriptionId,
            startDate: newStartDate,
            endDate: newEndDate,
            nextBillingDate: newBillingDate,
            autoRenew: true, // Keep auto-renewal active
            lastRenewalDate: new Date(),
            renewalNotificationShown: false // User hasn't seen notification yet
          });

          await newSubscription.save();

          // Mark old subscription as expired
          subscription.status = 'expired';
          await subscription.save();

          // Ensure user remains premium
          const user = await User.findById(subscription.user);
          if (user) {
            user.premiumStatus = 'active';
            await user.save();
            console.log(`✅ Auto-renewed subscription for user ${user.email}`);
          }

          renewed++;
        } else {
          // No auto-renewal, expire the subscription
          subscription.status = 'expired';
          await subscription.save();

          // Update user premium status
          const user = await User.findById(subscription.user);
          if (user && user.premiumStatus === 'active') {
            user.premiumStatus = 'expired';
            await user.save();
            console.log(`Expired subscription for user ${user.email}`);
          }

          expired++;
        }

      } catch (error) {
        console.error(`Error updating subscription ${subscription._id}:`, error.message);
      }
    }

    console.log(' Subscription status update completed');
    return { renewed, expired, total: expiredSubscriptions.length };

  } catch (error) {
    console.error(' Subscription status update failed:', error);
    throw error;
  }
}

// Standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/your-db-name')
    .then(() => {
      console.log('✅ Connected to MongoDB');
      return updateSubscriptionStatuses();
    })
    .then((result) => {
      console.log(' Results:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error(' Script failed:', error);
      process.exit(1);
    })
    .finally(() => {
      mongoose.disconnect();
    });
}
