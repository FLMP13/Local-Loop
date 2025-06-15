// File for defining routes in the Express application and map them to controller functions

const express = require('express');
const router = express.Router(); // Create a new Express Router instance


router.get('/', (req, res) => {
  res.send('Hello from the Backend!');
});

router.get('/test', (req, res) => {
  res.json({ message: 'This is a test route to the Backend!' });
});


module.exports = router;
