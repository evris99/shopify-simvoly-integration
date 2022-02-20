const koaRouter = require('koa-router');
const bodyParser = require('koa-bodyparser');
const crypto = require('crypto');
const dotenv = require("dotenv");
const CustomerRequest = require('../models/customerRequest');
const logger = require('../utils/logger');
const Merchant = require('../models/merchant');
dotenv.config();

const { API_SECRET_KEY } = process.env;

const router = new koaRouter();

router.post(
    '/gdpr/redact_customer',
    bodyParser(),
    verifyWebhook,
    logRequest,
    deleteCustomer
);

router.post(
    '/gdpr/redact_shop',
    bodyParser(),
    verifyWebhook,
    logRequest,
    deleteShop
);

router.post(
    '/gdpr/request_customer',
    bodyParser(),
    verifyWebhook,
    logRequest,
    requestCustomer
);

router.post(
    "/uninstall",
    bodyParser(),
    verifyWebhook,
    logRequest,
    handleUninstall
);

async function handleUninstall(ctx) {
    const shop = ctx.headers['x-shopify-shop-domain'];
    if(ctx.headers['x-shopify-topic'] !== "app/uninstalled" || shop == null) {
        const err = new Error("Invalid headers for uninstall webhook");
        err.status = 400;
        throw err;
    }
    const merchant = await Merchant.findOne({ shop });
    if(merchant == null) {
        const err = new Error("Mechant not found");
        err.status = 403;
        throw err;
    }
    merchant.installed = false;
    await merchant.save();
    ctx.status = 200;
}

async function logRequest(ctx, next) {
    logger.http(ctx.request.body);
    await next();
}

async function verifyWebhook(ctx, next) {
    const signature = ctx.headers["x-shopify-hmac-sha256"];
    const bodyString = Buffer.from(ctx.request.rawBody, "utf8");
    
    const hmac = crypto.createHmac("sha256", API_SECRET_KEY);
    hmac.update(bodyString);
    const hash = hmac.digest("base64");

    if (hash !== signature) {
        const err = new Error("Invalid webhook signature");
        err.status = 403;
        throw err;
    } else {
        await next();
    }
}

async function deleteCustomer(ctx) {
    const { shop_domain, customer } = ctx.request.body;
    const merchant = await Merchant.findOne({ shop: shop_domain }, "orders");
    merchant.orders = merchant.orders.filter(order => order.email !== customer.email);
    await merchant.save();
    ctx.status = 200;
}

async function deleteShop(ctx) {
    const { shop_domain } = ctx.request.body;
    await Merchant.deleteOne({ shop: shop_domain });
    ctx.status = 200;
}

async function requestCustomer(ctx) {
    const { shop_domain, customer } = ctx.request.body;
    const merchant = await Merchant.findOne({ shop: shop_domain }, "orders");
    const customerData = new CustomerRequest({ email: customer.email });
    customerData.orders = merchant.orders.filter(order => order.email === customer.email);
    await customerData.save();
    ctx.status = 200;
}

module.exports = router;