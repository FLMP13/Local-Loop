import jwt from 'jsonwebtoken';

// Middleware to authenticate requests using JWT by verifying the token and attaching the user ID to the request object
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    // No token: allow guest access
    return next();
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);                  // verify JWT
    req.userId = payload.sub;                                                   // attach user id
    req.user = payload; // Optionally attach the whole payload
    next();
  } catch (err) {
    // Invalid token: treat as guest
    return next();
  }
};

export default auth;
