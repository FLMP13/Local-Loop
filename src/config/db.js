// src/config/db.js
// This file contains the database connection logic
import mongoose from 'mongoose';
import config from './config.js';

// Connect to MongoDB
const connectDB = () => {
    return mongoose.connect(config.MONGO_URI);
};

// Export the connection function
export default connectDB;