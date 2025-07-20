import Item from '../models/item.js';
import ZipCode from '../models/zipCode.js';
import User from '../models/user.js';
import Transaction from '../models/transaction.js';
import { getDistanceFromZip } from '../utils/yourDistanceUtil.js';
import { checkListingLimit, isPremiumUser, calculateRentalPricing } from '../utils/premiumUtils.js';

// Look up the ZIP code and returns its coordinates
async function getLocationFromZip(zipCode) {
  const z = await ZipCode.findOne({ zipCode });
  if (!z) {
    const err = new Error(`Unknown ZIP code: ${zipCode}`);
    err.status = 400;
    throw err;
  }
  return {
    type: 'Point',
    coordinates: [z.longitude, z.latitude]
  };
}

// Get all items with optional filters and sorting 
export const getAllItems = async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search, sort } = req.query;
    const filter = {};

    // Apply filters based on query parameters
    if (category) filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    let sortOption = {};
    if (sort === 'price_asc')  sortOption.price = 1;
    else if (sort === 'price_desc') sortOption.price = -1;
    // Default: Priority sorting for premium users
    else sortOption = { createdAt: -1 };

    const items = await Item.find(filter)
      .sort(sortOption)
      .populate('owner', 'firstName lastName nickname email zipCode premiumStatus');

    // Fetch the user's zip code if logged in
    let userZip = null;
    if (req.userId) {
      const user = await User.findById(req.userId);
      userZip = user?.zipCode;
    }

    // Calculate distance and apply priority sorting for premium items
    const itemsWithDistance = await Promise.all(items.map(async item => {
      let distance = null;
      if (userZip && item.owner?.zipCode) {
        distance = await getDistanceFromZip(userZip, item.owner.zipCode);
      }
      
      // Add premium status for priority sorting
      const isOwnerPremium = isPremiumUser(item.owner);
      
      return { 
        ...item.toObject(), 
        distance,
        isPremiumListing: isOwnerPremium
      };
    }));

    // Apply priority sorting: premium listings first (unless price sorting is specified)
    let finalItems = itemsWithDistance;
    if (!sort || (sort !== 'price_asc' && sort !== 'price_desc')) {
      finalItems = itemsWithDistance.sort((a, b) => {
        // 1. Premium listings come first
        if (a.isPremiumListing && !b.isPremiumListing) return -1;
        if (!a.isPremiumListing && b.isPremiumListing) return 1;
        
        // 2. Among premium items: sort by view count (higher views = more popular)
        if (a.isPremiumListing && b.isPremiumListing) {
          if (b.viewCount !== a.viewCount) {
            return b.viewCount - a.viewCount;
          }
          // 3. If same view count: newer first
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        
        // 4. Among non-premium items: newer first
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
    }

    res.json(finalItems);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new item with images including availability and location
export const createItem = async (req, res) => {
  try {
    // Check listing limit before creating the item
    const limitCheck = await checkListingLimit(req.userId);
    if (!limitCheck.allowed) {
      const message = limitCheck.isPremium 
        ? 'Your premium plan has expired or there was an error. Please check your subscription status.'
        : 'You have reached the free user limit of 3 listings. Upgrade to premium for unlimited listings or remove some existing listings.';
        
      return res.status(403).json({ 
        error: 'Listing limit exceeded',
        code: 'LISTING_LIMIT_EXCEEDED',
        details: {
          currentListings: limitCheck.currentCount,
          maxListings: limitCheck.maxAllowed,
          isPremium: limitCheck.isPremium,
          message
        }
      });
    }

    // Parse availability from request body if provided
    let availability = [];
    if (req.body.availability) {
      availability = JSON.parse(req.body.availability);
    }

    const images = (req.files || []).map(f => ({
      data: f.buffer,
      contentType: f.mimetype
    }));

    // look up user zip code and get location coordinates
    const user     = await User.findById(req.userId, 'zipCode');
    const location = await getLocationFromZip(user.zipCode);

    // Create the item with all required fields
    const item = await Item.create({
      owner:        req.userId,
      title:        req.body.title,
      description:  req.body.description,
      price:        req.body.price,
      category:     req.body.category,
      images,                    
      availability,
      location
    });

    return res.status(201).json(item);
  } catch (err) {
    console.error('createItem error:', err);
    return res.status(err.status || 500).json({ error: err.message });
  }
};

// Delete an item by ID and return a success message
export const deleteItem = async (req, res) => {
  try {
    const id = req.params.id;
    const deletedItem = await Item.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(200).json({ message: 'Item deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an item by ID and return the updated item
export const updateItem = async (req, res) => {
  try {
    const id = req.params.id;
    const location = await getLocationFromZip(
      (await User.findById(req.userId)).zipCode
    );

    // merge & parse availability if sent
    let data = { ...req.body, location };
    if (req.body.availability != null) {
      data.availability = typeof req.body.availability === 'string'
        ? JSON.parse(req.body.availability)  
        : req.body.availability;             
    }

    const updatedItem = await Item.findByIdAndUpdate(id, data, { new: true });
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.status(200).json(updatedItem);
  } catch (error) {
    console.error('updateItem error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get an item by ID and return it with its owner details and distance from the user
export const getItemById = async (req, res) => {
  try {
    const item = await Item
      .findById(req.params.id)
      .populate('owner', 'firstName lastName nickname email zipCode')
      .lean();

    if (!item) return res.status(404).json({ error: 'Item not found' });

    // Increment view count for all views except when the owner views their own item
    const isOwnerViewing = req.userId && req.userId === item.owner._id.toString();
    if (!isOwnerViewing) {
      await Item.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
    }

    let distance = null;
    let pricing = null;
    
    if (req.userId) {
      const user = await User.findById(req.userId, 'zipCode premiumStatus');
      
      // Calculate distance if both users have zip codes
      if (user?.zipCode && item.owner?.zipCode) {
        distance = await getDistanceFromZip(user.zipCode, item.owner.zipCode);
      }
      
      // Calculate premium pricing for the viewing user
      if (user && !isOwnerViewing) {
        pricing = calculateRentalPricing(item.price, null, null, user);
      }
    }

    res.json({ 
      ...item, 
      distance,
      pricing: pricing || {
        originalPrice: item.price,
        finalPrice: item.price,
        discountRate: 0,
        discountAmount: 0,
        isPremium: false,
        weeklyRate: {
          original: item.price,
          final: item.price
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get an item image by item ID and image index
export const getItemImage = async (req, res) => {
  try {
    const { id, index } = req.params;
    const idx = parseInt(index, 10);

    const item = await Item.findById(id);
    if (!item) {
      return res.status(404).end('Item not found');
    }

    const img = item.images[idx];
    if (!img || !img.data) {
      return res.status(404).end('Image not found');
    }

    res.contentType(img.contentType);
    return res.send(img.data);

  } catch (err) {
    console.error('getItemImage error:', err);
    return res.status(500).end();
  }
};

// Update the status of an item by ID
export const updateItemStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const allowedStatuses = ['available', 'unavailable', 'requested', 'borrowed', 'lent', 'returned'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    const item = await Item.findByIdAndUpdate(id, { status }, { new: true });
    if (!item) {
      return res.status(404).json({ error: 'No Items found' });
    }
    res.status(200).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get user's own items with premium analytics
export const getMyItems = async (req, res) => {
  try {
    // Get user to check premium status
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's items with owner info populated
    const items = await Item.find({ owner: req.userId })
      .populate('owner', 'firstName lastName nickname email zipCode premiumStatus')
      .lean();

    // If user is premium, include view counts and analytics
    if (isPremiumUser(user)) {
      // For premium users, include full analytics
      const itemsWithAnalytics = items.map(item => ({
        ...item,
        viewCount: item.viewCount || 0,
        isPremiumAnalytics: true
      }));
      
      res.json(itemsWithAnalytics);
    } else {
      // For free users, exclude view counts
      const itemsWithoutAnalytics = items.map(item => {
        const { viewCount, ...itemWithoutViews } = item;
        return {
          ...itemWithoutViews,
          isPremiumAnalytics: false
        };
      });
      
      res.json(itemsWithoutAnalytics);
    }
  } catch (error) {
    console.error('getMyItems error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Get nearby items based on user's location, filters, and sorting options
export const getNearbyItems = async (req, res) => {
  try {
    const { radius = '', category, minPrice, maxPrice, search, sort } = req.query;
    const filter = {};

    // Filter logic 
    if (category)      filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    // Local logic 
    if (radius === 'local') {                              // exact same-ZIP filter
      const user = await User.findById(req.userId, 'zipCode');
      if (!user) return res.status(404).json({ error: 'User not found' });
      // find all users in that ZIP
      const sameZipUsers = await User.find({ zipCode: user.zipCode }, '_id');
      const ownerIds     = sameZipUsers.map(u => u._id);
      filter.owner       = { $in: ownerIds };
    } else if (radius && !isNaN(parseFloat(radius))) {      // numeric radius
      const center = await getLocationFromZip(
        (await User.findById(req.userId, 'zipCode')).zipCode
      );
      const meters = parseFloat(radius) * 1000;
      filter.location = {
        $nearSphere: {
          $geometry: center,
          $maxDistance: meters
        }
      };
    }

    // Sorting logic
    let sortOption = {};
    if (sort === 'price_asc')      sortOption.price = 1;
    else if (sort === 'price_desc') sortOption.price = -1;
    else sortOption._id = -1; // Default as Most Recent

    // Query & Respond
    const items = await Item
      .find(filter)
      .sort(sortOption)
      .populate('owner', 'firstName lastName nickname email zipCode');

    const user = await User.findById(req.userId, 'zipCode');
    const userZip = user?.zipCode;

    // Calculate distance for each item
    const itemsWithDistance = await Promise.all(items.map(async item => {
      let distance = null;
      if (userZip && item.owner?.zipCode) {
        distance = await getDistanceFromZip(userZip, item.owner.zipCode);
      }
      return {
        ...item.toObject(),
        distance,
      };
    }));
    res.json(itemsWithDistance);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

// Get unavailable periods for an item based on its transactions
export const getUnavailablePeriods = async (req, res) => {
  try {
    const { id } = req.params;
    // Find all accepted or borrowed transactions for this item
    const transactions = await Transaction.find({
      item: id,
      status: { $in: ['accepted', 'borrowed'] }
    });
    // Map to periods
    const periods = transactions.map(t => ({
      from: t.requestedFrom,
      to: t.requestedTo
    }));
    res.json(periods);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch unavailable periods.' });
  }
};