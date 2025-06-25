// Overlaying router for the application using the different router modules for items, auth, and users

const express     = require('express');
const itemsRouter = require('./item.routes');
const authRouter  = require('./auth.routes');
const usersRouter = require('./users.routes');

const router = express.Router();

router.use('/items', itemsRouter); // Use items router for item-related routes
router.use('/auth',  authRouter); // Use auth router for authentication routes
router.use('/users', usersRouter); // Use users router for user-related routes

module.exports = router;