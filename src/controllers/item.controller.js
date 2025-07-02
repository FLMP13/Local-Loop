// Controller Functions for Item Management
import Item from '../models/item.js'; // Import Item model
import ZipCode from '../models/zipCode.js'; // Import ZipCode model
import User from '../models/user.js';
import { getDistanceFromZip } from '../utils/yourDistanceUtil.js';

// Helper to get GeoJSON Point from a ZIP code
async function getLocationFromZip(zipCode) {
  const z = await ZipCode.findOne({ zipCode });
  if (!z) {
    const err = new Error(`Unknown ZIP code: ${zipCode}`);
    err.status = 400;
    throw err;
  }
  return {
    type: 'Point',
    coordinates: [z.longitude, z.latitude]           // [lon, lat]
  };
}

// Get all items and return them as JSON while populating owner details and sorting by price
// Supports filtering by category, price range, search term, and sorting options
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
      filter.title = { $regex: search, $options: 'i' }; // case-insensitive
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

// Create a new item with images and store it in the database
export const createItem = async (req, res) => {
  try {
    const images = (req.files || []).map(file => ({
      data: file.buffer,
      contentType: file.mimetype
    }));
    // derive location from user's ZIP code
    const user = await User.findById(req.userId, 'zipCode');
    const location = await getLocationFromZip(user.zipCode);
    const item = new Item({
      ...req.body,
      owner: req.userId,
      images,
      location
    });
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: error.message });
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

// Update an item by ID with new data and return the updated item
export const updateItem = async (req, res) => {
  try {
    const id = req.params.id;

    // Recalc location in case user’s ZIP changed
    const user = await User.findById(req.userId, 'zipCode');
    const location = await getLocationFromZip(user.zipCode);

    const updatedItem = await Item.findByIdAndUpdate(id, { ...req.body, location }, { new: true });
    if (!updatedItem) {
      return res.status(404).json({ error: 'Item not found' });
    } 
    res.status(200).json(updatedItem);
  } catch (error) {
    res.status(500).json({ error: error.message });
  } 
};

// Get an item by ID and return it as JSON, excluding image data
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

// Get an item by ID and return it with its images
export const getItemImage = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    const idx = parseInt(req.params.index, 10);
    if (!item || !item.images[idx]) return res.status(404).send('Image not found');
    res.contentType(item.images[idx].contentType);
    res.send(item.images[idx].data);
  } catch (err) {
    console.error('Error retrieving image:', err);
    res.status(500).send('Server error');
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

// GET /api/items/nearby?radius=…&category=…&minPrice=…&maxPrice=…&search=…&sort=…
export const getNearbyItems = async (req, res) => {
  try {
    const { radius = '', category, minPrice, maxPrice, search, sort } = req.query;
    const filter = {};

    // ── Standard filters ───────────────────────────────────────
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

    // ── Sorting ──────────────────────────────────────────────
    let sortOption = {};
    if (sort === 'price_asc')      sortOption.price = 1;
    else if (sort === 'price_desc') sortOption.price = -1;

    // ── Query & Respond ──────────────────────────────────────
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