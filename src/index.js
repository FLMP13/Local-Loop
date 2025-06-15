const express = require('express'); // Express framework for Node.js stored in express variable
const app = express(); // Instance of Express application stored in app variable
const mongoose = require('mongoose'); // RMongoose for MongoDB object modeling stored in mongoose variable
require('dotenv').config(); // Load environment variables from .env file

app.use(express.json()); //Parse incoming JSON requests into JavaScript objects

const apiRouter = require('./routes/routes') // Import routes from routes file
app.use('/api', apiRouter); // Use the imported routes for all requests

// Connect to MongoDB using Mongoose and handle connection errors
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        app.listen(process.env.PORT, () => {
        console.log(`Connected to DB and listening at http://localhost:${process.env.PORT}`);
        });
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
    });
