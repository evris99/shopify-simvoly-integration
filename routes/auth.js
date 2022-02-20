const koaRouter = require('koa-router');
const querystring = require('querystring');
const fetch = require('isomorphic-fetch');
const Merchant = require('../models/merchant');
const { createHmac } = require("crypto");
const { GraphQLClient, gql } = require("graphql-request");
const logger = require('../utils/logger');

const { API_KEY, API_SECRET_KEY, MY_DOMAIN } = process.env;

const router = new koaRouter();

router.get(
    "/auth/callback",
    handleAuth
);

/*
Handles the authentication
*/
async function handleAuth(ctx) {
    await verifyQuery(ctx.query);
    const credentials = await getAccessCredentials(ctx.query.shop, ctx.query.code)
    await saveCredentialsToDB(ctx.query.shop, credentials);
    await createUninstallWebhook(ctx.query.shop, credentials.access_token);
    ctx.redirect('/?shop=' + ctx.query.shop);
}

/*
Verifies the query
*/
async function verifyQuery(query) {
    //Test if shop matches the regular expression
    const regEx = /[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com[\/]?/;
    if(!regEx.test(query.shop)) {
        const err = new Error("Invalid query shop name for " + query.shop);
        err.status = 403;
        throw err;
    }

    //Test if nonce is the same as the database
    const merchant = await Merchant.findOne({ shop: query.shop }, "nonce");
    if(merchant.nonce !== query.state) {
        const err = new Error("Nonce not the same for " + query.shop);
        err.status = 403;
        throw err;
    }

    //Verify HMAC
    const hmacQuery = { ...query };
    delete hmacQuery.hmac;
    const bodyString = Buffer.from(querystring.stringify(hmacQuery), 'utf8');

    const hmac = createHmac('sha256', API_SECRET_KEY);
    hmac.update(bodyString);
    const digest = hmac.digest('hex');
    if(digest !== query.hmac) {
        const err = new Error("Hmac is different for " + query.shop);
        ctx.status = 403;
        throw err;
    }
}

async function getAccessCredentials(shop, code) {
    const body = {
        client_id: API_KEY,
        client_secret: API_SECRET_KEY,
        code
    };

    const fetchConfig = {
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        },
        method: "POST",
        body: JSON.stringify(body)
    };

    const response = await fetch(`https://${shop}/admin/oauth/access_token`, fetchConfig);
    if(response.ok) {
        return await response.json();
    } else {
        const err = new Error(response);
        err.status = 500;
        console.error(response);
        throw err;
    }
}

async function saveCredentialsToDB(shop, credentials) {
    const merchant = await Merchant.findOne({ shop });
    if(merchant == null) {
        const err = new Error("Merchant not found");
        err.status = 404;
        throw err;
    }
    merchant.accessToken = credentials.access_token;
    merchant.scopes = credentials.scope;
    merchant.installed = true;
    await merchant.save();
}

async function createUninstallWebhook(shop, accessToken) {
    const headers = { 'X-Shopify-Access-Token': accessToken };
    const graphqlClient = new GraphQLClient(`https://${shop}/admin/api/2021-01/graphql.json`, { headers });

    const query = gql`
        mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
            webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
                userErrors {
                    field
                    message
                }
                webhookSubscription {
                    id
                    endpoint {
                        ... on WebhookHttpEndpoint {
                            callbackUrl
                        }
                    }
                }
            }
        }
    `;

    const variables = {
        topic: "APP_UNINSTALLED",
        webhookSubscription: {
            callbackUrl: `https://${MY_DOMAIN}/uninstall`,
            format: "JSON"
        }
    };

    const response = await graphqlClient.request(query, variables);
    logger.http(response);
}

module.exports = router;