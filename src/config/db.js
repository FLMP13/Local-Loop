const mongoose = require('mongoose');
const dotenv = require('dotenv');
require('dotenv').config();

module.exports = () => {
    return mongoose.connect(process.env.MONGO_URI);
}