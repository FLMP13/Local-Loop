// Premium utilities for checking subscription status and limits

import User from '../models/user.js';
import Item from '../models/item.js';

/**
 * Check if user has active premium subscription
 * @param {Object} user - User object with subscription details
 * @returns {boolean} - True if user has active premium
 */
export const isPremiumUser = (user) => {
  return user?.premiumStatus === 'active';
};

/**
 * Get maximum allowed listings for user
 * @param {Object} user - User object
 * @returns {number|null} - 3 for free users, null for unlimited (premium)
 */
export const getMaxListings = (user) => {
  return isPremiumUser(user) ? null : 3;
};

/**
 * Check if user can create more listings
 * @param {string} userId - User ID to check
 * @returns {Object} - { allowed: boolean, currentCount: number, maxAllowed: number|null }
 */
export const checkListingLimit = async (userId) => {
  try {
    // Get user and current listing count in parallel
    const [user, currentCount] = await Promise.all([
      User.findById(userId),
      Item.countDocuments({ owner: userId })
    ]);

    if (!user) {
      return { allowed: false, error: 'User not found' };
    }

    // Premium users have unlimited listings
    if (isPremiumUser(user)) {
      return {
        allowed: true,
        currentCount,
        maxAllowed: null,
        isPremium: true
      };
    }

    // Free users limited to 3 listings
    const maxAllowed = 3;
    return {
      allowed: currentCount < maxAllowed,
      currentCount,
      maxAllowed,
      isPremium: false
    };

  } catch (error) {
    console.error('Error checking listing limit:', error);
    return { allowed: false, error: 'Database error' };
  }
};

/**
 * Get user's discount rate (for premium features)
 * @param {Object} user - User object
 * @returns {number} - Discount percentage (0 for free, 10 for premium)
 */
export const getUserDiscountRate = (user) => {
  return isPremiumUser(user) ? 10 : 0; // Premium users get 10% discount
};

/**
 * Calculate premium pricing for any rental
 * @param {number} weeklyPrice - Base weekly price
 * @param {Date|string} fromDate - Start date (optional)
 * @param {Date|string} toDate - End date (optional)
 * @param {Object} user - User object
 * @returns {Object} - Complete pricing breakdown
 */
export const calculateRentalPricing = (weeklyPrice, fromDate = null, toDate = null, user) => {
  let totalPrice = weeklyPrice;
  let weeks = 1;
  
  // Calculate weeks if dates provided
  if (fromDate && toDate) {
    const days = Math.ceil((new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1;
    weeks = Math.ceil(days / 7);
    totalPrice = weeks * weeklyPrice;
  }
  
  const discountRate = getUserDiscountRate(user);
  const discountAmount = parseFloat((totalPrice * (discountRate / 100)).toFixed(2));
  const finalPrice = parseFloat((totalPrice - discountAmount).toFixed(2));
  
  return {
    originalPrice: parseFloat(totalPrice.toFixed(2)),
    finalPrice: finalPrice,
    discountRate: discountRate,
    discountAmount: discountAmount,
    isPremium: isPremiumUser(user),
    weeks: weeks,
    weeklyRate: {
      original: parseFloat(weeklyPrice.toFixed(2)),
      final: parseFloat((weeklyPrice * (1 - discountRate / 100)).toFixed(2))
    }
  };
};

/**
 * Check if user has priority features
 * @param {Object} user - User object  
 * @returns {Object} - { listing: boolean, requests: boolean }
 */
export const getUserPriorityStatus = (user) => {
  if (!isPremiumUser(user)) {
    return { listing: false, requests: false };
  }

  // Premium users get both priority features
  return {
    listing: true,
    requests: true
  };
};
