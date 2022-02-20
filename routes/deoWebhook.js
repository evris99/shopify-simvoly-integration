const bodyParser = require("koa-bodyparser");
const koaRouter = require("koa-router");
const logger = require('../utils/logger');
const schedule = require('../utils/scheduler');
const Merchant = require('../models/merchant');
const { verifyHmac } = require('../utils/verifyHmac')
const Order = require('../utils/Order');

const router = new koaRouter();
router.post(
  "/webhook",
  getMerchant,
  bodyParser(),
  checkHmac,
  handleRequest
);

//Retrieves merchant data from database
async function getMerchant(ctx, next) {
  ctx.state.merchant = await Merchant.findOne({ deoSources: { $elemMatch: { deoURL: ctx.headers["x-webhook-source"] }}});
  //Check if merchant exists
  if(ctx.state.merchant == null) {
    const err = new Error("Merchant not found");
    err.status = 404;
    throw err;
  }
  logger.http(ctx.state.merchant);
  await next();
}

//Verifies the HMAC of the request
async function checkHmac(ctx, next) {
  const signature = ctx.headers["x-webhook-signature"];
  const deoSource = ctx.state.merchant.deoSources.find(el => el.deoURL === ctx.headers["x-webhook-source"]);
  if(deoSource == null || deoSource.webhookSecret == null) {
    const err = new Error("Merchant secret cannot be found")
    err.status = 500;
    throw err;
  }

  const isValidHmac = verifyHmac(signature, deoSource.webhookSecret, ctx.request.rawBody, "sha512");
  if (!isValidHmac) {
    const err = new Error("Invalid webhook signature");
    err.status = 403;
    throw err;
  }
  await next();
}

//Calls corresponding functions according to the webhook topic
async function handleRequest(ctx) {
  const order = new Order(ctx.state.merchant);
  order.funnelURL = ctx.headers["x-webhook-source"];
  order.fromDeoOrder(ctx.request.body);
  switch (ctx.headers["x-webhook-topic"]) {
    case "order_created":
      let draftOrderID = undefined;
      if(order.hasNoUnmatchedItems()) {
        draftOrderID = await order.createOrder();
        schedule(
          1200000, //20 minutes
          "complete order",
          {
            merchantID: ctx.state.merchant._id,
            draftOrderID,
            paymentMethod: ctx.request.body.paymentMethod
          }
        );
      }
      await order.insertToDB(draftOrderID);
      ctx.status = 200;
      break;
    case "order_updated":
      order.findOrder()
      if(order.hasNoUnmatchedItems() && order.hasExistingDraftOrder())
        await order.updateOrder();
      
      await order.updateDB()
      ctx.status = 200;
      break;
    default:
      ctx.status = 400;
  }
}

module.exports = router;
