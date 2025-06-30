// \Backend\src\controllers\user.controller.js
// Import user model and necessary libraries
const User     = require('../models/user');
const bcrypt   = require('bcrypt');
const mongoose = require('mongoose');

// Function to get the currently logged-in user's details
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// Function to get the avatar of the currently logged-in user
exports.getAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('profilePic');
    if (!user || !user.profilePic) return res.status(404).end();

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'profilePics'
    });
    const stream = bucket.openDownloadStream(user.profilePic);
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  } catch (err) {
    console.error('getAvatar error:', err);
    res.status(500).end();
  }
};

// Function to update the currently logged-in user's details
exports.updateMe = async (req, res) => {
  try {
    const updates = {};
    for (let field of ['nickname','email','zipCode','bio']) {
      if (req.body[field] != null) updates[field] = req.body[field];
    }
    if (req.file?.id) updates.profilePic = req.file.id;

    const user = await User.findByIdAndUpdate(
      req.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-passwordHash -__v');

    res.json(user);
  } catch (err) {
    console.error('updateMe error:', err);
    res.status(400).json({ error: err.message });
  }
};

// Function to change the password of the currently logged-in user
exports.changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Both old and new passwords required' });
    }
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Old password is incorrect' });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Password updated' });
  } catch (err) {
    console.error('changePassword error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};