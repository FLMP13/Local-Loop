import ZipCode from '../models/zipCode.js';

// Haversine formula to calculate distance between two lat/lon points in km
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = x => (x * Math.PI) / 180;
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10; // rounded to 0.1 km
}

// Async function to get distance between two zip codes
export async function getDistanceFromZip(zip1, zip2) {
  if (!zip1 || !zip2) return null;
  if (zip1 === zip2) return 0;
  const [z1, z2] = await Promise.all([
    ZipCode.findOne({ zipCode: zip1 }),
    ZipCode.findOne({ zipCode: zip2 })
  ]);
  if (!z1 || !z2) return null;
  return haversine(z1.latitude, z1.longitude, z2.latitude, z2.longitude);
}