// Import express, connectDB function, and dotenv for environment variables
const express = require('express');
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();
app.use(express.json());

// Import routes and use them
const apiRouter = require('./routes/routes') // Import routes
app.use('/api', apiRouter); // Use the routes under the /api prefix to handle API requests 


// Connect to MongoDB using the connectDB function
connectDB()
    .then(() => {
        app.listen(process.env.PORT, () => {
    console.log(`Backend listening on http://localhost:${process.env.PORT}`);
    });
}).catch(err => {
    console.error('MongoDB connection error:', err);
});