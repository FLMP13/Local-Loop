import Item from '../models/item.js';
import ZipCode from '../models/zipCode.js';
import User from '../models/user.js';
import Transaction from '../models/transaction.js';
import { getDistanceFromZip } from '../utils/yourDistanceUtil.js';

// This function looks up the ZIP code in the database and returns its coordinates
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

    const items = await Item.find(filter)
      .sort(sortOption)
      .populate('owner', 'firstName lastName nickname email zipCode');

    // Fetch the user's zip code from the DB if logged in
    let userZip = null;
    if (req.userId) {
      const user = await User.findById(req.userId);
      userZip = user?.zipCode;
    }

    // Calculate distance for each item based on the user's zip code and the item's owner's zip code
    const itemsWithDistance = await Promise.all(items.map(async item => {
      let distance = null;
      if (userZip && item.owner?.zipCode) {
        distance = await getDistanceFromZip(userZip, item.owner.zipCode);
      }
      return { ...item.toObject(), distance };
    }));

    res.json(itemsWithDistance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Create a new item with images and store it in the database including availability and location
export const createItem = async (req, res) => {
  try {
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

// Delete an item by ID
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
        ? JSON.parse(req.body.availability)   // parse only if string
        : req.body.availability;             // already an object/array
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

    let distance = null;
    if (req.userId && item.owner?.zipCode) {
      const user = await User.findById(req.userId, 'zipCode');
      if (user?.zipCode) {
        distance = await getDistanceFromZip(user.zipCode, item.owner.zipCode);
      }
    }

    res.json({ ...item, distance });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get an item image by item ID and image index
// Ongoing issues with image data not being sent correctly !
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

// Get all items owned by the logged-in user
export const getMyItems = async (req, res) => {
  try {
    const filter = { owner: req.userId };
    if (req.query.status) {
      filter.status = req.query.status;
    }
    const items = await Item.find(filter).populate('owner', 'firstName lastName nickname email zipCode');
    res.status(200).json(items);
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

    // ── Filters ──────────────────────────────────────────────
    if (category)      filter.category = category;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    if (search) {
      filter.title = { $regex: search, $options: 'i' };
    }

    // ── Radius / Local logic ──────────────────────────────────
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
    // else radius is '' or invalid → no geo filter

    // Sorting ────────────────────────────────────────────
    let sortOption = {};
    if (sort === 'price_asc')      sortOption.price = 1;
    else if (sort === 'price_desc') sortOption.price = -1;

    // Query & Respond ──────────────────────────────────────
    const items = await Item
      .find(filter)
      .sort(sortOption)
      .populate('owner', 'firstName lastName nickname email zipCode');

    const user = await User.findById(req.userId, 'zipCode');
    const userZip = user?.zipCode;

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