require("isomorphic-fetch");
const dotenv = require("dotenv");
dotenv.config();

const mongoose = require("mongoose");
const fs = require("fs");
const Koa = require("koa");
const next = require("next");
const Merchant = require("./models/merchant");
const deoWebhookRouter = require("./routes/deoWebhook");
const apiRouter = require("./routes/api");
const gdprWebhook = require("./routes/shopifyWebhook");
const logger = require("./utils/logger");
const morgan = require("koa-morgan");
const { randomBytes } = require("crypto");
const { stringify } = require("querystring");
const authRouter = require("./routes/auth");

const port = parseInt(process.env.PORT, 10) || 3000;
const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

const { API_SECRET_KEY, API_KEY, DATABASE_URL, SCOPE, MY_DOMAIN } = process.env;

//Connect to database. Exit on failure
mongoose.connect(DATABASE_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useFindAndModify: false,
});

// Output for logs
const accessLogStream = fs.createWriteStream(__dirname + '/logs/morgan.log', { flags: 'a' });
const database = mongoose.connection;

// Exit on connection error
database.on('error', error => {
    console.error(error);
    process.exit(1);
});


database.once('open', () => {
  app.prepare().then( async () => {    

    const server = new Koa();

    server.keys = [API_SECRET_KEY];

    server.on("error", handleError);

    //Error handling and log all http requests
    server
      .use(catchThrowError)
      .use(morgan("combined", { stream: accessLogStream }));

    //Use koa router for simvoly webhooks
    server
      .use(deoWebhookRouter.routes())
      .use(deoWebhookRouter.allowedMethods());

    //Use koa router for GDPR webhooks
    server
      .use(gdprWebhook.routes())
      .use(gdprWebhook.allowedMethods());

    server
      .use(apiRouter.routes())
      .use(apiRouter.allowedMethods());

    server
      .use(authRouter.routes())
      .use(authRouter.allowedMethods());

    server.use(authenticate);

    server
      .use(apiRouter.routes())
      .use(apiRouter.allowedMethods());

    //Handle request with Nextjs
    server.use(handleRequest);

    server.listen(port, () => {
      console.log(`> Ready on http://localhost:${port}`);
    });
  });
});

async function authenticate(ctx, next) {
  const shop = ctx.query.shop;
  if(shop != null) {
    //TODO verify hmac
    const needsOAuth = !(await Merchant.exists({ shop, installed: true, scopes: SCOPE }));
    if(needsOAuth) {
      const redirectUrl = await getRedirectUrl(shop);
      return ctx.redirect(redirectUrl);
    }
  }
  await next();
}

//If a middleware throws an error catch it and return the error
async function catchThrowError(ctx, next) {
  try {
    await next();
  } catch (error) {
    ctx.status = error.status || 500;
    ctx.app.emit("error", error, ctx);
  }
}

//Handles errors thrown by the koa server
function handleError(error){
  switch(error.message) {
    default:
      logger.log({level: 'error', message: error});
  }
}

//Use nextjs request handler
async function handleRequest(ctx) {
  await handle(ctx.req, ctx.res);
  ctx.respond = false;
  ctx.res.statusCode = 200;
  return;
}

async function getRedirectUrl(shop) {

  const nonce = randomBytes(10).toString('hex');

  const query = {
    client_id: API_KEY,
    scope: SCOPE,
    redirect_uri: `https://${MY_DOMAIN}/auth/callback`,
    state: nonce
  };

  await Merchant.updateOne(
    { shop },
    { nonce }, 
    { upsert: true }
  ).exec();

  return `https://${shop}/admin/oauth/authorize?${stringify(query)}`;
}