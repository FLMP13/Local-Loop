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
            'Furniture', // Is that something to lend/borrow? // NO :) needs to be adapted for the whole list
            'Clothing',
            'Books',
            'Sports', // Is that something to lend/borrow? // NO :) needs to be adapted for the whole list
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
        required: true //optional? No at least one image should be required i guess
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true 
    },
    location: {
    type: { 
      type: String, 
      enum: ['Point'], 
      required: true 
    },
    coordinates: {
      type: [Number],   // [longitude, latitude]
      required: true
    }
  },
    status: {
        type: String,
        required: true,
        enum: ['available', 'unavailable', 'requested', 'borrowed', 'lent', 'returned'],
        default: 'available'
    }
});

// create a 2dsphere index on location
itemSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Item', itemSchema); // Export the Item model based on the defined schema