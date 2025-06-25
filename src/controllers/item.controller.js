// Controller Functions for Item Management
import Item from '../models/item.js'; // Import Item model

// Get all items and return them as JSON while populating owner details
export const getAllItems = async (req, res) => {
  try {
    const items = await Item.find().populate('owner', 'firstName lastName');
    res.status(200).json(items);
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
    const item = new Item({
      ...req.body,
      owner: req.userId,
      images
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
    const updatedItem = await Item.findByIdAndUpdate(id, req.body, { new: true });
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
      .findById(req.params.id).lean()
      .populate('owner', 'firstName lastName')
      .lean();
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    item.images = item.images ? item.images.map(img => ({})) : [];
    res.status(200).json(item);
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
    const items = await Item.find(filter).populate('owner', 'firstName lastName');
    res.status(200).json(items);
  } catch (error) {
    console.error('getMyItems error:', error);
    res.status(500).json({ error: error.message });
  }
};