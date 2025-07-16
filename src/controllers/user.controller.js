// \Backend\src\controllers\user.controller.js
// Import user model and necessary libraries
import User from '../models/user.js';
import bcrypt from 'bcrypt';
import mongoose from 'mongoose';

// Function to get the currently logged-in user's details
export async function getMe(req, res) {
  try {
    const user = await User.findById(req.userId).select('-passwordHash -__v');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('getMe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Function to get the avatar of the currently logged-in user
export async function getAvatar(req, res) {
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
}

// Function to update the currently logged-in user's details
export async function updateMe(req, res) {
  try {
    const updates = {};
    for (let field of ['nickname','email','zipCode','bio']) {
      if (req.body[field] != null) updates[field] = req.body[field];
    }
    
    // Handle avatar deletion
    if (req.body.deleteAvatar === 'true') {
      // Get the current user to check if they have a profile pic to delete
      const currentUser = await User.findById(req.userId).select('profilePic');
      if (currentUser?.profilePic) {
        // Delete the file from GridFS
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
          bucketName: 'profilePics'
        });
        try {
          await bucket.delete(currentUser.profilePic);
        } catch (deleteErr) {
          console.warn('Could not delete old profile pic:', deleteErr);
        }
      }
      updates.profilePic = null; // Remove profile pic reference
    } else if (req.file?.id) {
      // Handle avatar upload (existing logic)
      // First delete the old avatar if it exists
      const currentUser = await User.findById(req.userId).select('profilePic');
      if (currentUser?.profilePic) {
        const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
          bucketName: 'profilePics'
        });
        try {
          await bucket.delete(currentUser.profilePic);
        } catch (deleteErr) {
          console.warn('Could not delete old profile pic:', deleteErr);
        }
      }
      updates.profilePic = req.file.id;
    }

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
}

// Function to change the password of the currently logged-in user
export async function changePassword(req, res) {
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
}

// Function to get public user profile by ID
export async function getUserById(req, res) {
  try {
    const user = await User.findById(req.params.userId).select('-passwordHash -__v -email');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('getUserById error:', err);
    res.status(500).json({ error: 'Server error' });
  }
}

// Function to get public user avatar by ID
export async function getUserAvatar(req, res) {
  try {
    const user = await User.findById(req.params.userId).select('profilePic');
    if (!user || !user.profilePic) return res.status(404).end();

    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: 'profilePics'
    });
    const stream = bucket.openDownloadStream(user.profilePic);
    stream.on('error', () => res.status(404).end());
    stream.pipe(res);
  } catch (err) {
    console.error('getUserAvatar error:', err);
    res.status(500).end();
  }
}