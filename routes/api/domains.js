const { randomBytes } = require("crypto");
const fetch = require("isomorphic-fetch");
const Merchant = require("../../models/merchant");
const logger = require("../../utils/logger");
const { Types } = require("mongoose");

const { MY_DOMAIN } = process.env;

/*
Sends the merchant's settings as a response
*/
async function getDomains(ctx) {
    const merchant = await Merchant.findOne({ shop: ctx.state.shop }).select("deoSources._id deoSources.deoURL deoSources.apiKey");
    if(merchant == null) {
        const err = new Error("Merchant not found");
        err.status = 403;
        throw err;
    }

    ctx.status = 200;
    ctx.body = JSON.stringify(merchant.deoSources);
}

/*
Receives a url and api key, creates a webhook in DEO and saves
it in the database. It returns the id of the new database entry
*/
async function newDomain(ctx) {
    const { deoURL, apiKey } = ctx.request.body;
    
    //Check if this deo store is linked to another shopify store
    const otherConnectedStores = await Merchant
        .where('deoSources.deoURL', deoURL)
        .where('shop').ne(ctx.state.shop)
        .countDocuments();
    
    if(otherConnectedStores !== 0) return ctx.status = 403;
    
    const merchant = await Merchant.findOne({ shop: ctx.state.shop }, "deoSources");

    const deoSource = merchant.deoSources.find(source => source.deoURL === deoURL);
    if(deoSource != null && deoSource.webhookID != null)
        await deleteDEOWebhook(deoURL, apiKey, deoSource.webhookID);
        
    const [webhookID, webhookSecret] = await createDEOWebhook(deoURL, apiKey);
    const _id = Types.ObjectId()

    merchant.deoSources.push({
        _id,
        deoURL,
        apiKey,
        webhookID,
        webhookSecret
    });

    await merchant.save();
    ctx.status = 200;
    ctx.body = JSON.stringify({ _id });
}

/*
Deletes a domain from the database
*/
async function deleteDomains(ctx) {
    const domainIDs = ctx.request.body;
    const merchant = await Merchant.findOne({ shop: ctx.state.shop }, "deoSources");
    if(merchant == null) {
        const err = new Error("Merchant not found");
        err.status = 403;
        throw err;
    }

    for(let id of domainIDs) {
        const deoSource = merchant.deoSources.find(source => source._id.toString() === id);
        if(deoSource === undefined) {
            const err = new Error("Domain not in database");
            err.status = 500;
            throw err;
        }
        await deleteDEOWebhook(deoSource.deoURL, deoSource.apiKey, deoSource.webhookID);
        merchant.deoSources.pull(deoSource._id);
    }

    await merchant.save();
    ctx.status = 200;
}

/*
Creates a webhook for the order created and order updated
events and returns the webhook id and webhook secret
*/
async function createDEOWebhook(deoURL, apiKey) {
    //Create random string to use as secret
    const webhookSecret = randomBytes(16).toString('hex');

    const reqData = {
        target: `https://${MY_DOMAIN}/webhook`,
        secret: webhookSecret,
        events: [
            "order_created",
            "order_updated"
        ]
    };

    const fetchConfig = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        method: "POST",
        body: JSON.stringify(reqData)
    };

    logger.http(fetchConfig);
    
    const response = await fetch(`https://${deoURL}/api/site/webhooks`, fetchConfig);
    if(response.ok) {
        const data = await response.json();
        logger.http(data);
        return [data.id, webhookSecret];
    } else {
        const err = new Error(response);
        err.status = 400;
        throw err;
    }
}

/*
Removes a webhook from DEO
*/
async function deleteDEOWebhook(deoURL, apiKey, webhookID) {
    const fetchConfig = {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
        },
        method: "DELETE"
    };

    logger.http(fetchConfig);

    const response = await fetch(`https://${deoURL}/api/site/webhooks/${webhookID}`, fetchConfig);
    if(response.ok) {
        const data = await response.json();
        logger.http(data);
    } else {
        const err = new Error(response);
        err.status = 500;
        throw err;
    }
}

module.exports = { getDomains, newDomain, deleteDomains };