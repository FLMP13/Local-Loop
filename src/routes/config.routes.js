import express from "express";
import auth from "../middleware/auth.js";

const router = express.Router();
// Route to get PayPal configuration
router.get("/paypal", auth, (req, res) => {
  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID,
    currency: "EUR",
  });
});
export default router;