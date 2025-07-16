import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';
import config from '../config/config.js';

// Signup function to create a new user and hash the password
export async function signup(req, res, next) {
  try {
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

    // Debug: Log user data to see what's available
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