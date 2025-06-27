// src/middleware/auth.js
const jwt = require('jsonwebtoken');

// Middleware to authenticate requests using JWT by verifying the token and attaching the user ID to the request object
module.exports = function(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' }); // enforce auth

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);                  // verify JWT
    req.userId = payload.sub;                                                   // attach user id
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });         // clear error
  }
};
