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
        required: true,
        enum: [
            'Electronics',
            'Furniture', // Is that something to lend/borrow?
            'Clothing',
            'Books',
            'Sports', // Is that something to lend/borrow?
            'Toys',
            'Tools',
            'Other'
        ]
    },
    images: {
        type: [
            {
                data: Buffer,
                contentType: String
            }
        ],
        validate: [arr => arr.length <= 3, 'At most 3 images are allowed'],
        default: [],
        required: true //optional?
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true 
    },
    status: {
        type: String,
        required: true,
        enum: ['available', 'unavailable', 'requested', 'borrowed', 'lent', 'returned'],
        default: 'available'
    }
});

module.exports = mongoose.model('Item', itemSchema); // Export the Item model based on the defined schema