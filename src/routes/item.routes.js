const express   = require('express');
const multer    = require('multer');
const auth      = require('../middleware/auth');
const {
  getAllItems,
  getItemById,
  getItemImage,
  createItem,
  updateItem,
  deleteItem,
  updateItemStatus,
  getMyItems
} = require('../controllers/item.controller'); // Use controller functions for item operations

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { files: 3 } });

// public
router.get('/mine',          auth, getMyItems); // Get items owned by the authenticated user
router.get('/:id/image/:index', getItemImage); // Get specific image of an item by index
router.get('/:id',           getItemById); // Get item by ID
router.get('/',              getAllItems); // Get all items


// protected

router.post('/',             auth, upload.array('images', 3), createItem); // Create a new item with images as authenticated user
router.put('/:id',           auth, updateItem); // Update an item by ID as authenticated user
router.delete('/:id',        auth, deleteItem); // Delete an item by ID as authenticated user
router.patch('/:id/status',  auth, updateItemStatus); // Update the status of an item by ID as authenticated user

module.exports = router;