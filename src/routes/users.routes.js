import express from 'express';
import auth from '../middleware/auth.js';
import gridFsFactory from '../config/gridfsStorage.js';
import multer from 'multer';
import {
  getMe,
  getAvatar,
  updateMe,
  changePassword,
  getUserById,
  getUserAvatar
} from '../controllers/user.controller.js';

const router = express.Router();

const setupRoutes = async () => {
  const storage = await gridFsFactory({ bucketName: 'profilePics' });
  const upload = multer({ storage });

  router.get('/me', auth, getMe);
  router.get('/me/avatar', auth, getAvatar);
  router.get('/:userId', getUserById);
  router.get('/:userId/avatar', getUserAvatar);
  router.put('/me', auth, upload.single('avatar'), updateMe);
  router.put('/me/password', auth, changePassword);
};
setupRoutes();

export default router;