// src/routes/auth.js
const express  = require('express');
const bcrypt   = require('bcrypt');
const jwt      = require('jsonwebtoken');
const multer   = require('multer');
const mongoose = require('mongoose');

const gridFsStorage = require('../config/gridfsStorage');
const User     = require('../models/user');

const router = express.Router();

(async () => {
  const storage = await gridFsStorage({ bucketName: 'profilePics' });
  const upload = multer({ storage });

  // POST /api/auth/signup
  router.post(
    '/signup',
    upload.single('profilePic'),
    async (req, res) => {
      try {
        // 1. Hash the password
        const hash = await bcrypt.hash(req.body.password, 10);

        // 2. Build the user data
        const u = {
          firstName:    req.body.firstName,
          lastName:     req.body.lastName,
          nickname:     req.body.nickname,
          email:        req.body.email,
          passwordHash: hash,
          zipCode:      req.body.zipCode,
          bio:          req.body.bio,
          // 3. Save the ObjectId of the GridFS file:
          profilePic:   req.file?.id,
        };

      // 4. Save in Mongo
        const user = await User.create(u);
        res.status(201).json({ message: 'User created', userId: user._id });
      } catch (err) {
        console.error(err);
        res.status(400).json({ error: err.message });
      }
    }
  );

  // POST /api/auth/login
  router.post(
    '/login',
    async (req, res) => {
      try {
        const { email, password } = req.body;

      // 1. Find the user by email
        const user = await User.findOne({ email });
        if (!user) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

      // 2. Compare passwords
        const isMatch = await bcrypt.compare(password, user.passwordHash);
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid email or password' });
        }

      // 3. Sign a JWT
        const payload = { sub: user._id, nickname: user.nickname };
        const token = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: '7d'                              // ← adjust as desired
        });

        // 4. Return token & basic user info
        res.json({
          message: 'Login successful',
          token, 
          user: {
            id:       user._id,
            nickname: user.nickname,
            email:    user.email,
            profilePic: user.profilePic
          }
        });
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
      }
    }
  );
})();

exports.getMyItems = async (req, res) => {
  console.log('getMyItems called, userId:', req.userId);
  try {
    const items = await Item.find({ owner: req.userId });
    res.status(200).json(items);
  } catch (error) {
    console.error('getMyItems error:', error); 
    res.status(500).json({ error: error.message });
  }
};

module.exports = router;
