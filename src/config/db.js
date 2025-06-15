const mongoose = require('mongoose');
const dotenv = require('dotenv');
require('dotenv').config(); // Load environment variables from .env file

module.exports = () => {
    return mongoose.connect(process.env.MONGO_URI);
}