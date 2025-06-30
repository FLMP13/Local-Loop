// src/utils/loadZipCodes.js
const fs      = require('fs');
const path    = require('path');
const csv     = require('csv-parser');
const connect = require('../config/db');    
const ZipCode = require('../models/zipCode');

async function loadZipCodes() {
  await connect();                           
  const rows = [];
  fs.createReadStream(path.join(__dirname, '../../data/zip_centroids.csv'))
    .pipe(csv())
    .on('data', row => {
      rows.push({
        zipCode: row.zipCode,
        latitude: parseFloat(row.lat),
        longitude: parseFloat(row.lng)
      });
    })
    .on('end', async () => {
      try {
        await ZipCode.deleteMany({});        // clear any old data
        await ZipCode.insertMany(rows);
        console.log(`Inserted ${rows.length} ZIP centroids`);
        process.exit(0);
      } catch (err) {
        console.error('Failed loading ZIP codes:', err);
        process.exit(1);
      }
    });
}

// If run via `node loadZipCodes.js`, invoke automatically:
if (require.main === module) {
  loadZipCodes();
}

module.exports = loadZipCodes; // allow import elsewhere
