const { Types } = require("mongoose")
const Merchant = require("../../models/merchant");
const schedule = require("../../utils/scheduler");

/*
Sends the merchant's unmatched products as a response
*/
async function getUnmatched(ctx) {
    const merchant = await Merchant.findOne({ shop: ctx.state.shop }, "unmatchedProducts");
    if(merchant == null) {
        const err = new Error("Merchant not found");
        err.status = 403;
        throw err;
    }

    ctx.status = 200;
    ctx.body = JSON.stringify(merchant.unmatchedProducts);
}

//Finds the merchant and stores it in the context
async function findMerchant(ctx, next) {
    ctx.state.merchant = await Merchant.findOne({ shop: ctx.state.shop });
    await next();
}

/*
Removes the product from unmatched products
and adds it to the matched products
*/
async function convertProductToMatched(ctx, next) {
    const product = ctx.request.body;

    const index = ctx.state.merchant.unmatchedProducts.findIndex(
        item => item._id.toString() === product._id.toString()
    );

    if(index === -1) {
        const error = new Error("Unmatched product not found");
        error.status = 404;
        throw error;
    }

    ctx.state.merchant.unmatchedProducts.splice(index, 1);
    product._id = Types.ObjectId();
    ctx.state.merchant.matchedProducts.push(product);
    await next();
}

/*
Loops through the orders, changes the product to matched
and if the order does not have an unmatched order it
schedules a job to complete it
*/
async function proccessOrders(ctx, next) {
    const product = ctx.request.body;

    ctx.state.merchant.orders.forEach((order, orderIndex) => {
        const unmatchedProductIndex = order.unmatchedProducts.findIndex(prod => prod.product.deoID === product.deoID);
        
        if(unmatchedProductIndex !== -1) {
            //Add product to matched products
            order.matchedProducts.push({ quantity: order.unmatchedProducts[unmatchedProductIndex].quantity, product: product });
            //Remove product from unmatched products
            order.unmatchedProducts.splice(unmatchedProductIndex, 1);

            //If the order does not have any unmatched products
            if(!order.unmatchedProducts.length) {
                const job = order.draftOrderID === undefined ? "create and complete" : "update and complete";
                schedule(
                    120000,
                    job,
                    {
                        merchantID: ctx.state.merchant._id,
                        orderIndex
                    }
                );
            }
        }
    });
    await next();
}

//Save changes to database and respond with success code
async function saveChanges(ctx) {
    await ctx.state.merchant.save();
    ctx.status = 200;
}

module.exports = { getUnmatched, findMerchant, convertProductToMatched, proccessOrders, saveChanges };