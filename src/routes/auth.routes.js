import express from 'express';
import multer from 'multer';
import gridFsFactory from '../config/gridfsStorage.js';
import { signup, login } from '../controllers/auth.controller.js';

const router = express.Router();

// Setup routes for user authentication
const setupRoutes = async () => {
  const storage = await gridFsFactory({ bucketName: 'profilePics' });
  const upload = multer({ storage });
  router.post('/signup', upload.single('profilePic'), signup);
  router.post('/login', login);
};
setupRoutes();

export default router;