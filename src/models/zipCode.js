const mongoose = require('mongoose');

const zipCodeSchema = new mongoose.Schema({
  zipCode: {
    type: String,
    required: true,
    unique: true               // ensure one entry per ZIP
  },
  latitude: {
    type: Number,
    required: true
  },
  longitude: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('ZipCode', zipCodeSchema);
