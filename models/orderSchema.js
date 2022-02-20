const { Schema } = require('mongoose');
const { matchedProductSchema, unmatchedProductSchema } = require('./productSchema');

const addressSchema = Schema({
    address1: String,
    address2: String,
    city: String,
    countryCode: String,
    zip: String,
    province: String,
    firstName: String,
    lastName: String,
    phone: String
});

const orderMatchedProductSchema = Schema({
	quantity: Number,
	product: matchedProductSchema
});

const orderUnmatchedProductSchema = Schema({
	quantity: Number,
	product: unmatchedProductSchema
});
  
const orderSchema = Schema({
    deoOrderID: Number,
    draftOrderID: String,
    email: String,
    paymentMethod: String,
    shippingAddress: addressSchema,
    billingAddress: addressSchema,
    shippingLine: {
      title: String,
      price: Number
    },
    matchedProducts: [orderMatchedProductSchema],
    unmatchedProducts: [orderUnmatchedProductSchema]
});

module.exports = orderSchema;