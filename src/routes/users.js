// src/routes/users.js
const express  = require('express');
const mongoose = require('mongoose');
const multer   = require('multer');
const bcrypt   = require('bcrypt');

const auth     = require('../middleware/auth');                                
const gridFsStorage = require('../config/gridfsStorage');
const upload   = multer({ storage: gridFsStorage({ bucketName: 'profilePics' }) });

const User     = require('../models/user');

const router = express.Router();

// GET /api/users/me
router.get(
  '/me',
  auth,                                                                         // protect route
  async (req, res) => {
    try {
      const user = await User.findById(req.userId)
        .select('-passwordHash -__v');                                          
      if (!user) return res.status(404).json({ error: 'User not found' });

      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

// GET /api/users/me/avatar
router.get(
  '/me/avatar',
  auth,                                                                         
  async (req, res) => {
    try {
      const user = await User.findById(req.userId).select('profilePic');
      if (!user || !user.profilePic) return res.status(404).end();

      const bucket = new mongoose.mongo.GridFSBucket(
        mongoose.connection.db,
        { bucketName: 'profilePics' }
      );                                                                         

      const stream = bucket.openDownloadStream(user.profilePic);
      stream.on('error', () => res.status(404).end());
      stream.pipe(res);
    } catch (err) {
      console.error(err);
      res.status(500).end();
    }
  }
);

// PUT /api/users/me
router.put(
  '/me',
  auth,                                                                         
  upload.single('avatar'),                                                      
  async (req, res) => {
    try {
      const updates = {};
      ['nickname','email','zipCode','bio'].forEach(field => {
        if (req.body[field] != null) updates[field] = req.body[field];
      });

      if (req.file && req.file.id) {
        updates.profilePic = req.file.id;                                        // new avatar
      }

      const user = await User.findByIdAndUpdate(
        req.userId,
        { $set: updates },
        { new: true, runValidators: true }                                       // validate & return fresh doc
      ).select('-passwordHash -__v');

      res.json(user);
    } catch (err) {
      console.error(err);
      res.status(400).json({ error: err.message });
    }
  }
);

// PUT /api/users/me/password
router.put(
  '/me/password',
  auth,                                                                         
  async (req, res) => {
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

      user.passwordHash = await bcrypt.hash(newPassword, 10);                   // update hash
      await user.save();
      res.json({ message: 'Password updated' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  }
);

module.exports = router;
