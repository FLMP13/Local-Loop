import mongoose from 'mongoose';

const zipCodeSchema = new mongoose.Schema({
  zipCode: { type: String, required: true, unique: true },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true }
});

const ZipCode = mongoose.model('ZipCode', zipCodeSchema);

export default ZipCode;
