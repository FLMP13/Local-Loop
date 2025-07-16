require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcrypt');
const User     = require('./models/user.js');

async function seed() {
  // 1. Connect to MongoDB
  await mongoose.connect(process.env.MONGO_URI);
  console.log('🗄  Connected to MongoDB for seeding');

  // 2. Check if the admin user already exists
  const existing = await User.findOne({ email: 'admin@localhost' });
  if (existing) {
    console.log('ℹ️  Admin user already exists, skipping creation.');
  } else {
    // 3. Hash a default password (you can also pull this from an env var)
    const plainPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    // 4. Create the admin user
    await User.create({
      firstName:   'Admin',
      lastName:    'User',
      nickname:    'theadmin',
      email:       'admin@localhost',
      passwordHash,
      premiumStatus: 'active',
       zipCode:     '12345',
    });
    console.log('✅  Admin user created with email=admin@localhost');
  }

  // 5. Exit the process
  process.exit(0);
}

seed().catch(err => {
  console.error('❌  Seeding error:', err);
  process.exit(1);
});
