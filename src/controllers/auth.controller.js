const bcrypt = require('bcrypt');
const jwt    = require('jsonwebtoken');
const User   = require('../models/user');

// Signup function to create a new user and hash the password
exports.signup = async (req, res, next) => {
  try {
    const hash = await bcrypt.hash(req.body.password, 10);
    const user = await User.create({
      ...req.body,
      passwordHash: hash,
      profilePic: req.file?.id
    });
    res.status(201).json({ message: 'User created', userId: user._id });
  } catch (err) {
    next(err);
  }
};

// Login function to authenticate a user and return a JWT token
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!await bcrypt.compare(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ sub: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, nickname: user.nickname, email: user.email, profilePic: user.profilePic } });
  } catch (err) {
    next(err);
  }
};