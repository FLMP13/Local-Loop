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
            'Furniture',
            'Clothing',
            'Books',
            'Sports',
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
        required: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // Change when implementing user authentication
    },
    availability: {
        type: Boolean,
        required: true,
        default: true
    }
});

module.exports = mongoose.model('Item', itemSchema); // Export the Item model based on the defined schema