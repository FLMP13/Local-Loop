import mongoose from 'mongoose';

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
        required: true 
    },
    location: {
    type: { 
      type: String, 
      enum: ['Point'], 
      required: true 
    },
    coordinates: {
      type: [Number],  
      required: true
    }
  },
    status: {
        type: String,
        required: true,
        enum: ['available', 'unavailable', 'requested', 'borrowed', 'lent', 'returned'],
        default: 'available'
    },
    availability: {
        type: [
            {
                from: Date,
                to: Date
            }
        ],
        default: []
    },
    viewCount: {
        type: Number,
        default: 0
    }
});

// create a 2dsphere index on location
itemSchema.index({ location: '2dsphere' });

const Item = mongoose.model('Item', itemSchema);

export default Item;