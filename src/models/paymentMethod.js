
// This file defines the Mongoose schema enumeration for payment methods in the lending platform.
// !!!ToDo: Do we need this as a schema? Other ways?!!!

const mongoose = require('mongoose');

// Define the values
const PaymentMethodEnum = {
  PAYPAL: 'PayPal',
  CARD: 'Card',
};
Object.freeze(PaymentMethodEnum);

// Define the schema using the enumeration
const paymentMethodSchema = new mongoose.Schema({
  method: {
    type: String,
    enum: Object.values(PaymentMethodEnum),
    required: true,
  },
});

module.exports = {
  PaymentMethod: mongoose.model('PaymentMethod', paymentMethodSchema),
  PaymentMethodEnum,
};