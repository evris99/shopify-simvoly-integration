const logger = require("../utils/logger");
const Merchant = require('../models/merchant');
const Order = require('./Order');

function schedule(delay, type, data) {
  let callback;
  switch(type) {
    case "complete order":
      callback = completeOrder;
      break;
    case "create and complete":
      callback = createCompleteOrder;
      break;
    case "update and complete":
      callback = updateCompleteOrder;
      break;
    default:
      throw new Error("Invalid schedule event type");
  }
  setTimeout(callback, delay, data);
}

async function completeOrder(data) {
  try {
    const { merchantID, draftOrderID, paymentMethod } = data;
    const merchant = await Merchant.findById(merchantID);
    const order = new Order(merchant);

    const foundOrder = merchant.orders.find(order => order.draftOrderID === draftOrderID);
    if(foundOrder === undefined) throw new Error("Order not found");
    if(foundOrder.unmatchedProducts.length !== 0) return;

    order.payment = paymentMethod;
    await order.completeOrder(draftOrderID);
    await deleteDBOrder(merchant, undefined, draftOrderID);
  } catch(err) {
    logger.log({level: 'error', message: err});
  }
}

async function createCompleteOrder(data) {
  try {
    const { merchantID, orderIndex } = data;
    const merchant = await Merchant.findById(merchantID);
    const order = new Order(merchant);
    order.fromDatabaseOrder(orderIndex);
    const draftOrderID = await order.createOrder();
    await order.completeOrder(draftOrderID);
    await deleteDBOrder(merchant, orderIndex);
  } catch(err) {
    logger.log({level: 'error', message: err});
  }
}

async function updateCompleteOrder(data) {
  try {
    const { merchantID, orderIndex } = data;
    const merchant = await Merchant.findById(merchantID);
    const order = new Order(merchant);
    order.fromDatabaseOrder(orderIndex);
    const draftOrderID = await order.updateOrder();
    await order.completeOrder(draftOrderID);
    await deleteDBOrder(merchant, orderIndex);
  } catch(err) {
    logger.log({level: 'error', message: err});
  }
}

//Deletes an order from the database
async function deleteDBOrder(merchant, orderIndex, draftOrderID) {

  if(orderIndex != null) {
    merchant.orders.splice(orderIndex, 1);
  } else if(draftOrderID != null) {
    const order = merchant.orders.find(doc => doc.draftOrderID === draftOrderID);
    if(order == null) throw new Error("Order not found");
    merchant.orders.pull(order._id);
  } else {
    throw new Error("Invalid arguments to deleteDBOrder");
  }

  await merchant.save();
}

module.exports = schedule;