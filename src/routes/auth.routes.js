const express       = require('express');
const multer        = require('multer');
const gridFsFactory = require('../config/gridfsStorage');
const { signup, login } = require('../controllers/auth.controller'); // Use controller functions for signup and login

const router = express.Router();

(async () => {
  const storage = await gridFsFactory({ bucketName: 'profilePics' }); // Create a GridFS storage instance for profile pictures
  const upload  = multer({ storage }); // Configure multer to use GridFS storage
  router.post('/signup', upload.single('profilePic'), signup); // Handle user signup with profile picture upload
  router.post('/login',  login); // Handle user login
})();

module.exports = router;