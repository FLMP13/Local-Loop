// Import express, connectDB function, and dotenv for environment variables
const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();
app.use(express.json());

// Import routes and use them
const apiRouter = require('./routes/routes') // Import routes
app.use('/api', apiRouter); // Use the routes under the /api prefix to handle API requests 
const mongoose = require('mongoose');
// Make sure the User model is registered with mongoose
require('./models/user');


// Connect to MongoDB using the connectDB function
connectDB()
  .then(async () => {
    // --- START OF ADDED INDEX-SYNC LOGIC ---
    try {
      const result = await mongoose.model('User').syncIndexes();
      console.log('🔑 User indexes synced:', result);
    } catch (err) {
      console.error('❌ Error syncing User indexes:', err);
    }

    // Import routes and use them with the '/api' prefix
    const apiRouter = require('./routes/routes') // Import routes
    app.use('/api', apiRouter);

    // --- END OF ADDED INDEX-SYNC LOGIC ---

    app.listen(process.env.PORT, () => {
      console.log(`Backend listening on http://localhost:${process.env.PORT}`);
    });
  })
  .catch(err => {
    console.error('MongoDB connection error:', err);
  });