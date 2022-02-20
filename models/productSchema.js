const { Schema } = require("mongoose");

const matchedProductSchema = Schema({
  deoID: Number,
  deoURL: String,
  deoName: String,
  shopifyID: String,
  name: String,
  variantName: String,
  image: String,
  deoImage: String,
  quantity: Number,
  discount: {
    discountType: String,
    discountValue: Number
  }
});

const unmatchedProductSchema = Schema({
  deoID: Number,
  deoURL: String,
  deoName: String,
  deoImage: String
});

module.exports = { matchedProductSchema, unmatchedProductSchema }
