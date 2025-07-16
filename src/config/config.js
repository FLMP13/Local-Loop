export default {
  PORT: process.env.PORT || 3000,
  // Use Docker MongoDB when MONGO_URI is provided via environment, otherwise use your cloud MongoDB
  MONGO_URI: process.env.MONGO_URI || "mongodb+srv://SeBaAdmin:SeBa2025@localloop.7ty0q8l.mongodb.net/?retryWrites=true&w=majority&appName=LocalLoop",
  PAYPAL_CLIENT_ID: process.env.PAYPAL_CLIENT_ID || "AXP0w_XIqcSbu3OdhrghpzVSIDbxSDiWHSXEc7leSJmnEeqD11GJYP3swV_ppwaxcYcJzTCN7gIN3xFc",
  JWT_SECRET: process.env.JWT_SECRET || "aSuperLongRandomString"
};

