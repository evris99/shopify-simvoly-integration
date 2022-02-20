const {Schema, model} = require("mongoose");
const { matchedProductSchema, unmatchedProductSchema } = require('./productSchema');
const orderSchema = require('./orderSchema');
const deoSourceSchema = require('./deoSourceSchema');

const merchantSchema = Schema({
  shop: String,
  accessToken: String,
  installed: Boolean,
  scopes: String,
  nonce: String,
  deoSources: [deoSourceSchema],
  matchedProducts: [matchedProductSchema],
  unmatchedProducts: [unmatchedProductSchema],
  orders: [orderSchema]
});

module.exports = model("Merchant", merchantSchema);
