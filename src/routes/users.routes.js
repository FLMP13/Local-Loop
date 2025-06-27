const express       = require('express');
const auth          = require('../middleware/auth');
const gridFsFactory = require('../config/gridfsStorage');
const multer        = require('multer');
const {
  getMe,
  getAvatar,
  updateMe,
  changePassword
} = require('../controllers/user.controller'); // Use controller functions for user operations

const router = express.Router();

(async () => {
  const storage = await gridFsFactory({ bucketName: 'profilePics' }); // Create a GridFS storage instance for profile pictures
  const upload  = multer({ storage }); // Configure multer to use GridFS storage

  router.get( '/me',          auth, getMe); // Get the currently logged-in user's details
  router.get( '/me/avatar',   auth, getAvatar); // Get the avatar of the currently logged-in user
  router.put( '/me',          auth, upload.single('avatar'), updateMe); // Update the currently logged-in user's details with optional avatar upload
  router.put( '/me/password', auth, changePassword); // Change the password of the currently logged-in user
})();

module.exports = router;