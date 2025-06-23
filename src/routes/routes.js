// File for defining routes in the Express application and map them to controller functions

const express = require('express');
const router = express.Router(); // Create a new Express Router instance
const Item = require('../models/item'); // Import the Item model
const multer = require('multer'); // Import multer for handling file uploads
const storage = multer.memoryStorage(); // Use memory storage for file uploads
const upload = multer({ storage: storage, limits: { files: 3 } }); // Create a multer instance with the memory storage
const { getAllItems, createItem, deleteItem, updateItem, getItemById, getItemImage} = require('../controllers/item.controller');

// Get route to fetch all items using the controller function
router.get('/items', getAllItems);

// Post route to handle item creation using the controller function
router.post('/items', upload.array('images', 3), createItem);

// Delete route to handle item deletion by ID using the controller function
router.delete('/items/:id', deleteItem);

// Put route to handle item updates by ID using the controller function
router.put('/items/:id', updateItem);

router.get('/items/:id/image/:index', getItemImage);

router.get('/items/:id', getItemById);

const authRouter = require('./auth');
const usersRouter= require('./users');   

router.use('/auth', authRouter); 
router.use('/users', usersRouter);

router.get('/', (req, res) => {
  res.send('Hello from the Backend!');
});

router.get('/test', (req, res) => {
  res.json({ message: 'This is a test route to the Backend!' });
});


module.exports = router;
