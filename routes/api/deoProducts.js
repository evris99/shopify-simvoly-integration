const fetch = require("isomorphic-fetch");
const Merchant = require("../../models/merchant");

async function getDeoProducts(ctx) {
    const { page, funnelURL } = ctx.request.body;
    const merchant = await Merchant.findOne({ shop: ctx.state.shop });
    if(merchant == null) {
        const err = new Error("Merchant not found");
        err.status = 404;
        throw err;
    }

    const source = merchant.deoSources.find(el => el.deoURL === funnelURL);
    if(source == null) {
        const err = new Error("Funnel not found");
        err.status = 405;
        throw err;
    }

    const products = await makeDEORequest(page, funnelURL, source.apiKey);
    ctx.body = filterProductProperties(products, page);
    ctx.status = 200;
}

async function makeDEORequest(page, funnel, accessToken) {
    const limit = 10;
    const skip = (page - 1) * limit;

    headers = {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json"
    };

    const response = await fetch(`https://${funnel}/api/site/products?limit=${limit}&skip=${skip}`, { headers });
    if(!response.ok) {
        const err = new Error("DEO API call returned error");
        err.status = 500;
        throw err;
    }

    return response.json();
}

function filterProductProperties(products, page) {
    const response = {};
    if(page === 1) response.total = products.totalCount;

    response.products = products.items.map(product => ({
        id: product.id,
        title: product.title,
        image: product.images[0]
    }));

    return response;
}

module.exports = { getDeoProducts };