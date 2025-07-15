import express from "express";
import auth from "../middleware/auth.js";
import config from "../config/config.js";

const router = express.Router();
// Route to get PayPal configuration
router.get("/paypal", auth, (req, res) => {
  res.json({
    clientId: config.PAYPAL_CLIENT_ID,
    currency: "EUR",
  });
});
export default router;