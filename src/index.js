import express from 'express';
import mongoose from 'mongoose';
import config from './config/config.js';
import cors from 'cors';
import multer from 'multer';
import './models/user.js';           // register User model
import './models/zipCode.js';        // register ZipCode model
import './models/transaction.js';    // register Transaction model
import './models/review.js';        // register Review model
import connectDB from './config/db.js';
import loadZipCodes from './utils/loadZipCodes.js';
import apiRouter from './routes/index.routes.js';


const app = express();

// CORS configuration for Docker environment
const corsOptions = {
  origin: ['http://localhost:8080', 'http://localhost:3000', 'http://frontend:80'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions)); // Enable CORS with specific options
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/api', apiRouter); // mount the main API router on the /api path

connectDB()
  .then(async () => {
    console.log('MongoDB connected');

    // load ZIPs if empty ───────────────────────
    const ZipCode = mongoose.model('ZipCode');
    const count = await ZipCode.countDocuments();
    if (count === 0) {
      console.log('ZIP collection empty — loading centroids…');
      await loadZipCodes();
    }

    await mongoose.model('User').syncIndexes(); // ensure indexes are created for the User model
    await ZipCode.syncIndexes(); // ensure indexes are created for the ZipCode model

    // Health check endpoint for Docker
    app.get('/api/health', (req, res) => {
      res.status(200).json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
      });
    });

    // global error handler
    app.use((err, req, res, next) => {
      console.error(err);
      
      // Handle multer errors
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Too many files. Only one file allowed.' });
        }
        return res.status(400).json({ error: err.message });
      }
      
      // Handle other errors
      res
        .status(err.status || 500)
        .json({ error: err.message || 'Server error' });
    });

    app.listen(config.PORT, () => {
      console.log(`Server listening on http://localhost:${config.PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
  });