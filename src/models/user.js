// This file defines the User model for MongoDB using Mongoose.

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6
    },
    email: {
        type: String,
        required: true,
        unique: true,
    },
    zipCode: {
        type: String,
        required: true
    },
    passwordHash: {
        type: String,
        required: true
    },
    subscription: {
        type: String,
        enum: ['free', 'premium'],
        default: 'free'
    }
});

module.exports = mongoose.model('User', userSchema);


