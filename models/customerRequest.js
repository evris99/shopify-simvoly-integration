const { Schema, model } = require('mongoose');
const orderSchema = require('./orderSchema');

const customerRequestSchema = new Schema({
    email: String,
    orders: [orderSchema]
});

module.exports = model('CustomerRequest', customerRequestSchema);