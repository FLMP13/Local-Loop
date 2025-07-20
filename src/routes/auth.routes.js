import express from 'express';
import multer from 'multer';
import gridFsFactory from '../config/gridfsStorage.js';
import { signup, login } from '../controllers/auth.controller.js';

const router = express.Router();

// Setup routes for user authentication
const setupRoutes = async () => {
  const storage = await gridFsFactory({ bucketName: 'profilePics' });
  const upload = multer({ 
    storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit
      files: 1
    },
    fileFilter: (req, file, cb) => {
      // Check if file is an image
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'), false);
      }
    }
  });
  router.post('/signup', upload.single('profilePic'), signup);
  router.post('/login', login);
};
setupRoutes();

export default router;