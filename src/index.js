const express   = require('express');
const mongoose  = require('mongoose');
require('dotenv').config();
require('./models/user');           // register User model
require('./models/zipCode');        // register ZipCode model
const connectDB = require('./config/db');
const loadZipCodes = require('./utils/loadZipCodes');
const apiRouter = require('./routes/index.routes'); // import the main API router which includes all other routers from auth, users, and items

const app = express();
app.use(express.json());
app.use('/api', apiRouter); // mount the main API router on the /api path

connectDB()
  .then(async () => {
    console.log('MongoDB connected');

    //load ZIPs if empty ───────────────────────
    const ZipCode = mongoose.model('ZipCode');
    const count   = await ZipCode.countDocuments();
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