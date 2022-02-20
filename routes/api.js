const koaRouter = require("koa-router");
const bodyParser = require("koa-bodyparser");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv")

dotenv.config();

const { getDomains, newDomain, deleteDomains } = require("./api/domains");
const { getUnmatched, findMerchant, convertProductToMatched, proccessOrders, saveChanges} = require("./api/unmatched");
const { getMatchedProducts, saveMatchedProduct, updateMatchedProduct, deleteMatchedProduct } = require("./api/matched");
const { getDeoProducts } = require("./api/deoProducts");

const { API_KEY, API_SECRET_KEY } = process.env;

const router = new koaRouter();

router.get(
    "/api/domains",
    verifyRequest,
    getDomains
);

router.post(
    "/api/domains",
    verifyRequest,
    bodyParser(),
    newDomain
);

router.delete(
    "/api/domains",
    verifyRequest,
    bodyParser(),
    deleteDomains
);

router.get(
    "/api/matched",
    verifyRequest,
    getMatchedProducts
);

router.post(
    "/api/matched",
    verifyRequest,
    bodyParser(),
    saveMatchedProduct
);

router.put(
    "/api/matched",
    verifyRequest,
    bodyParser(),
    updateMatchedProduct
);

router.delete(
    "/api/matched",
    verifyRequest,
    bodyParser(),
    deleteMatchedProduct
);

router.get(
    "/api/unmatched",
    verifyRequest,
    getUnmatched
);

router.post(
    "/api/unmatched",
    verifyRequest,
    bodyParser(),
    findMerchant,
    convertProductToMatched,
    proccessOrders,
    saveChanges
);

router.post(
    "/api/deo_products",
    verifyRequest,
    bodyParser(),
    getDeoProducts
);

/*
Verifies the JWT token from the header and and the shop to the state
*/
async function verifyRequest(ctx, next) {
    const header = ctx.headers['authorization'];
    if(header == null) {
        const err = new Error("Missing authorization header");
        err.status = 403;
        throw err;
    }
    const token = header.split(' ')[1];
    const session = jwt.verify(token, API_SECRET_KEY, { ignoreExpiration: true });
    
    const currentTime = Math.floor(Date.now() / 1000);
    const expireTime = session.exp + 3600;
    const notValidDate = expireTime < currentTime || session.nbf > currentTime;
    const notValidShop = session.iss.substring(0, session.iss.lastIndexOf('/')) !== session.dest;
    const notValidKey = session.aud !== API_KEY;
    if(notValidDate || notValidShop || notValidKey) {
        const err = new Error(`Invalid session token. DateError ${notValidDate} ShopError ${notValidShop} KeyError ${notValidKey}`);
        err.status = 403;
        throw err;
    }
    //Remove the protocol from the URL
    ctx.state.shop = session.dest.replace(/(^\w+:|^)\/\//, '');
    await next();
}

module.exports = router;