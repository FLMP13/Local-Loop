// src/utils/backfillItemLocations.js
const mongoose   = require('mongoose');
const connectDB  = require('../config/db');

// register schemas
require('../models/user');
require('../models/item');
require('../models/zipCode');

const Item       = mongoose.model('Item');
const ZipCode    = mongoose.model('ZipCode');

// This script backfills the location field of items based on the owner's zip code
async function backfill() {
  await connectDB();

  // populate only the zipCode field of the owner
  const items = await Item.find().populate('owner', 'zipCode');
  let updated = 0;

  for (let item of items) {
    // skip if no owner was populated
    if (!item.owner) {
      console.warn(`Skipping item ${item._id}: owner not found`);
      continue;
    }

    const userZip = item.owner.zipCode;
    if (!userZip) {
      console.warn(`Skipping item ${item._id}: owner has no zipCode`);
      continue;
    }

    const zipDoc = await ZipCode.findOne({ zipCode: userZip });
    if (!zipDoc) {
      console.warn(`Skipping item ${item._id}: no centroid for ZIP ${userZip}`);
      continue;
    }

    item.location = {
      type: 'Point',
      coordinates: [zipDoc.longitude, zipDoc.latitude]
    };
    await item.save();
    updated++;
  }

  console.log(`Backfilled location on ${updated}/${items.length} items`);
  process.exit(0);
}

if (require.main === module) backfill();
module.exports = backfill;
