// src/controllers/auth.controller.js
// This file contains the authentication controller logic
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import config from '../config/config.js';

// Signup function to create a new user and hash the password
export async function signup(req, res, next) {
  try {
    const { password } = req.body;
    
    // Password validation
    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number' 
      });
    }

    const hash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      ...req.body,
      passwordHash: hash,
      profilePic: req.file?.id
    });
    
    // Generate token and return user data for automatic login
    const token = jwt.sign({ sub: user._id }, config.JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ 
      message: 'User created',
      token, 
      user: { 
        id: user._id, 
        firstName: user.firstName,
        lastName: user.lastName,
        nickname: user.nickname, 
        email: user.email, 
        profilePic: user.profilePic 
      } 
    });
  } catch (err) {
    next(err);
  }
}

// Login function to authenticate a user and return a JWT token
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ sub: user._id }, config.JWT_SECRET, { expiresIn: '7d' });

    // Log user data for debugging
    console.log('User data from database:', {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      nickname: user.nickname,
      email: user.email
    });
    
    res.json({ 
      token, 
      user: { 
        id: user._id, 
        firstName: user.firstName,
        lastName: user.lastName,
        nickname: user.nickname, 
        email: user.email, 
        profilePic: user.profilePic 
      } 
    });
  } catch (err) {
    next(err);
  }
}