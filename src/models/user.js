// This file defines the User model for MongoDB using Mongoose.

import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  firstName:   { type: String, required: true },
  lastName:    { type: String, required: true },
  nickname:    { type: String, required: false },
  email:       { type: String, required: true, lowercase: true },
  passwordHash:{ type: String, required: true },      
  zipCode:     { type: String, required: true },
  bio:         { type: String, required: false },
  profilePic:  { type: mongoose.Schema.Types.ObjectId, ref: 'profilePics.files', required: false },
  subscription:{ type: String, enum: ['free','premium'], default: 'free' },
  lenderRating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 }},
  borrowerRating: { average: { type: Number, default: 0 }, count: { type: Number, default: 0 }}
}, { timestamps: true });

userSchema.index({ email:    1 }, { unique: true });
userSchema.index({ nickname:    1 }, { unique: true, sparse: true });

const User = mongoose.model('User', userSchema);

export default User;
