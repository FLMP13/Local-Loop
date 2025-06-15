// This file defines the Mongoose schema for an item in the lending platform.

const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    category: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        required: false,
        default: []
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    availability: {
        type: Boolean,
        required: true,
        default: true
    }
});

module.exports = mongoose.model('Item', itemSchema);