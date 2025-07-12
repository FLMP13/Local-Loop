import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { fileURLToPath } from 'url';
import connect from '../config/db.js';
import ZipCode from '../models/zipCode.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        await ZipCode.deleteMany({});
        await ZipCode.insertMany(rows);
        console.log(`Inserted ${rows.length} ZIP centroids`);
        process.exit(0);
      } catch (err) {
        console.error('Failed loading ZIP codes:', err);
        process.exit(1);
      }
    });
}

// If run directly: node loadZipCodes.js
if (process.argv[1] === __filename) {
  loadZipCodes();
}

export default loadZipCodes;
