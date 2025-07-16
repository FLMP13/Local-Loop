import express from 'express';
import multer from 'multer';
import auth from '../middleware/auth.js';
import {
  getAllItems,
  getItemById,
  getItemImage,
  createItem,
  updateItem,
  deleteItem,
  updateItemStatus,
  getMyItems,
  getNearbyItems,
  getUnavailablePeriods
} from '../controllers/item.controller.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 3 } });

// public
router.get('/mine',          auth, getMyItems); // Get items owned by the authenticated user
router.get('/nearby',        auth, getNearbyItems);   // Items within radius (km)
router.get('/:id/image/:index', getItemImage); // Get specific image of an item by index
router.get('/:id',           auth, getItemById); // Get item by ID (optional auth for distance calculation)
router.get('/',              auth, getAllItems); // Get all items
router.get('/:id/unavailable', getUnavailablePeriods); // Get unavailable periods of an item by ID

// protected
router.post('/',             auth, upload.array('images', 3), createItem); // Create a new item with images as authenticated user
router.put('/:id',           auth, updateItem); // Update an item by ID as authenticated user
router.delete('/:id',        auth, deleteItem); // Delete an item by ID as authenticated user
router.patch('/:id/status',  auth, updateItemStatus); // Update the status of an item by ID as authenticated user

export default router;