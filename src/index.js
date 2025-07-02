import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import './models/user.js';           // register User model
import './models/zipCode.js';        // register ZipCode model
import './models/transaction.js';    // register Transaction model
import connectDB from './config/db.js';
import loadZipCodes from './utils/loadZipCodes.js';
import apiRouter from './routes/index.routes.js';

dotenv.config();

const app = express();
app.use(express.json());
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

    // global error handler
    app.use((err, req, res, next) => {
      console.error(err);
      res
        .status(err.status || 500)
        .json({ error: err.message || 'Server error' });
    });

    app.listen(process.env.PORT, () => {
      console.log(`Server listening on http://localhost:${process.env.PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to connect to MongoDB:', err);
  });