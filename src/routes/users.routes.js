import express from 'express';
import auth from '../middleware/auth.js';
import gridFsFactory from '../config/gridfsStorage.js';
import multer from 'multer';
import {
  getMe,
  getAvatar,
  updateMe,
  changePassword,
  getPremiumStatus,
  upgradeToPremium,
  cancelPremium,
  setPremiumStatus,
  getUserById,
  getUserAvatar
} from '../controllers/user.controller.js';

const router = express.Router();

// Setup routes for user-related operations
const setupRoutes = async () => {
  const storage = await gridFsFactory({ bucketName: 'profilePics' });
  const upload = multer({ storage });

  // User routes
  router.get('/me', auth, getMe);
  router.get('/me/avatar', auth, getAvatar);
  router.get('/:userId', getUserById);
  router.get('/:userId/avatar', getUserAvatar);
  router.put('/me', auth, upload.single('avatar'), updateMe);
  router.put('/me/password', auth, changePassword);
  
  // Premium routes
  router.get('/me/premium', auth, getPremiumStatus);
  router.post('/me/premium/upgrade', auth, upgradeToPremium);
  router.post('/me/premium/cancel', auth, cancelPremium);
  router.post('/me/premium/set-status', auth, setPremiumStatus);
};
setupRoutes();

export default router;