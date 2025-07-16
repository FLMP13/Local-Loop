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

// Route to get PayPal plans for premium subscriptions
router.get("/paypal/plans", auth, (req, res) => {
  res.json({
    plans: {
      monthly: {
        id: config.PAYPAL_MONTHLY_PLAN_ID || "P-3TT94183MC487024WNB3IRKI",
        name: "Premium Monthly",
        price: "3.99",
        currency: "EUR",
        interval: "MONTH",
      },
      yearly: {
        id: config.PAYPAL_YEARLY_PLAN_ID || "P-0JY26374DB1999900NB3IRKI",
        name: "Premium Yearly", 
        price: "35.99",
        currency: "EUR",
        interval: "YEAR",
      },
    },
  });
});

export default router;