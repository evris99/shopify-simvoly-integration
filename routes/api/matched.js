const { Types } = require("mongoose");
const Merchant = require("../../models/merchant");

/*
Sends the merchant's matched products as a response
*/
async function getMatchedProducts(ctx) {
    const merchant = await Merchant.findOne({ shop: ctx.state.shop }, "matchedProducts deoSources.deoURL");
    if(merchant == null) {
        const err = new Error("Merchant not found");
        err.status = 403;
        throw err;
    }

    const respose = {
        matchedProducts: merchant.matchedProducts,
        deoURLs: merchant.deoSources.map(source => source.deoURL)
    };

    ctx.status = 200;
    ctx.body = JSON.stringify(respose);
}

//Saves the new product to database
async function saveMatchedProduct(ctx) {
    const product = ctx.request.body;
    const merchant = await Merchant.findOne({ shop: ctx.state.shop });
    product._id = Types.ObjectId();
    merchant.matchedProducts.push(product);
    await merchant.save();

    ctx.status = 200;
    ctx.response.body = JSON.stringify({ id: product._id })
}

//Updates an existing products in the database
async function updateMatchedProduct(ctx) {
    const product = ctx.request.body;
    const merchant = await Merchant.findOne({ shop: ctx.state.shop });
    const index = merchant.matchedProducts.findIndex(arrayItem => arrayItem._id == product._id);
    merchant.matchedProducts[index] = product;
    await merchant.save();

    ctx.status = 200;
}

//Deletes a product from the database
async function deleteMatchedProduct(ctx) {
    const { productID } = ctx.request.body;
    const merchant = await Merchant.findOne({ shop: ctx.state.shop });
    merchant.matchedProducts.pull({ _id: productID });
    await merchant.save();

    ctx.status = 200;
}

module.exports = { getMatchedProducts, saveMatchedProduct, updateMatchedProduct, deleteMatchedProduct };