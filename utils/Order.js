const fetch = require("isomorphic-fetch");
const { GraphQLClient, gql } = require("graphql-request")
const logger = require("../utils/logger")

class Order {
    constructor(merchant) {
        this.merchant = merchant;
    }

    set funnelURL(url) {
        this.deoURL = url
    }

    set payment(method) {
        this.paymentMethod = method;
    }

    /*
    Takes the order from simvoly api and stores it in the object
    The api documentation https://websitebuilder.docs.apiary.io/#reference/orders
    */
    fromDeoOrder(order) {
        this.deoOrderID = order.id
        this.paymentMethod = order.paymentMethod;
        this.customer = {
            email: order.customerEmail,
            billingAddress: getAddress("billingAddress", order),
            shippingAddress: getAddress("shippingAddress", order),
            shippingLine: {
                title: order.shippingName,
                price: order.shippingAmount.toString()
            }
        }

        if(order.shippingAddress.phone !== undefined)
            this.customer.shippingAddress.phone = order.shippingAddress.phone;

        if(order.billingAddress.phone !== undefined)
            this.customer.billingAddress.phone = order.billingAddress.phone;

        [this.matchedItems, this.unmatchedItems] = getMatchingItems(order.items, this.merchant, this.deoURL);
    }

    fromDatabaseOrder(orderIndex) {
        const order = this.merchant.orders[orderIndex];
        this.deoOrderID = order.deoOrderID;
        this.paymentMethod = order.paymentMethod,
        this.customer = {
            email: order.email,
            billingAddress: order.billingAddress.toObject(),
            shippingAddress: order.shippingAddress.toObject(),
            shippingLine: order.shippingLine.toObject()
        }

        //Remove the mongoDB object ID
        delete this.customer.billingAddress._id;
        delete this.customer.shippingAddress._id;

        this.orderIndex = orderIndex;
        this.matchedItems = order.matchedProducts.toObject();
    }

    /*
    Used for updating orders.
    Searches if there is a pending order with the same deo order ID
    */
    findOrder() {
        this.orderIndex = this.merchant.orders.findIndex(order => order.deoOrderID === this.deoOrderID);
        if(this.orderIndex === -1) {
            const err = new Error("Could not find order to update");
            err.status = 400;
            throw err;
        }
    }

    /*
    Creates a new draft order
    */
    async createOrder() {
        const qlClient = getGraphQLClient(this.merchant.shop, this.merchant.accessToken);
        const [query, variables] = this.getCreateRequest();
        const response = await qlClient.request(query, variables);
        logger.http(response);
        checkUserError(response, "draftOrderCreate");
        return response.draftOrderCreate.draftOrder.id;
    }

    /*
    Updates an existing draft order
    */
    async updateOrder() {
        const qlClient = getGraphQLClient(this.merchant.shop, this.merchant.accessToken);
        const [query, variables] = this.getUpdateRequest(this.merchant.orders[this.orderIndex].draftOrderID);
        const response = await qlClient.request(query, variables);
        logger.http(response);
        checkUserError(response, "draftOrderUpdate");
        return response.draftOrderUpdate.draftOrder.id;
    }

    /*
    Marks the draft order as completed
    */
    async completeOrder(draftOrderID) {
        const qlClient = getGraphQLClient(this.merchant.shop, this.merchant.accessToken);
        const [query, variables] = getCompleteRequest(draftOrderID);
        const response = await qlClient.request(query, variables);
        logger.http(response);
        checkUserError(response, "draftOrderComplete");
        await completeTransaction(
            this.paymentMethod,
            this.merchant.shop,
            this.merchant.accessToken,
            response.draftOrderComplete.draftOrder.order.id
        );
    }

    /*
    Appends a new order in the Merchant database document
    */
    async insertToDB(draftOrderID) {
        const order = Object.assign({}, this.customer)
        order.deoOrderID = this.deoOrderID

        if(draftOrderID !== undefined)
            order.draftOrderID = draftOrderID

        order.paymentMethod = this.paymentMethod;
        order.matchedProducts = this.matchedItems;
        order.unmatchedProducts = this.unmatchedItems;
        order.unmatchedProducts.forEach(addUnmatched.bind(this, this.merchant));

        this.merchant.orders.push(order);
        await this.merchant.save();
    }

    /*
    Updates an existing order in the Merchant database document
    */
    async updateDB() {
        this.merchant.orders[this.orderIndex].matchedProducts = this.matchedItems;
        this.merchant.orders[this.orderIndex].unmatchedProducts = this.unmatchedItems;
        this.unmatchedItems.forEach(addUnmatched.bind(this, this.merchant));
        
        await this.merchant.save();
    }

    /*
    Returns the query and variables to be used in a GraphQL
    request for creating a new draft order
    */
    getCreateRequest() {
        const query = gql`
            mutation draftOrderCreate($input: DraftOrderInput!) {
                draftOrderCreate(input: $input) {
                    draftOrder {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;
    
        const variables = { input: this.customer }
        variables.input.lineItems = getLineItems(this.matchedItems)
        return [query, variables];
    }

    /*
    Returns the query and variables to be used in a GraphQL
    request for updating an existing draft order
    */
    getUpdateRequest(draftOrderID) {
        const query = gql`
            mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                draftOrderUpdate(id: $id, input: $input) {
                    draftOrder {
                        id
                    }
                    userErrors {
                        field
                        message
                    }
                }
            }
        `;

        const variables = {
            id: draftOrderID,
            input: {
                lineItems: getLineItems(this.matchedItems)
            }
        };
        return [query, variables];
    }

    //Returns true if the order has no unmatched items
    hasNoUnmatchedItems() {
        return this.unmatchedItems.length === 0;
    }

    //Returns true if there is a draft order in shopify for this order
    hasExistingDraftOrder() {
        return this.merchant.orders[this.orderIndex].draftOrderID != null;
    }
}

function addUnmatched(merchant, item) {
    const notFound = merchant.unmatchedProducts.findIndex(prod => prod.deoID == item.product.deoID && prod.deoURL === item.product.deoURL) === -1;
    if(notFound) merchant.unmatchedProducts.push(item.product);
}

//Checks for errors in a mutation response
//Accepts the response and the mutation's name as parameters
function checkUserError(response, mutationName) {
    const mutation = response[mutationName];
    if(Array.isArray(mutation.userErrors) && mutation.userErrors.length) {
      const err = new Error(JSON.stringify(response));
      err.status = 400;
      throw err;
    }
  }

//Accepts the items from the order and the products from the database
//and returns an array of object for completing graphql requests
function getLineItems(matchedItems) {
    const lineItems = matchedItems.map(item => ({
      variantId: item.product.shopifyID,
      quantity: item.product.quantity * item.quantity,
      appliedDiscount: {
        valueType: item.product.discount.discountType,
        value: item.product.discount.discountValue
      }
    }));
  
    return lineItems;
  }

function getGraphQLClient(shop, accessToken) {
    const headers = { headers: { "X-Shopify-Access-Token": accessToken }};
    const endpoint = `https://${shop}/admin/api/2020-07/graphql.json`;
    return new GraphQLClient(endpoint, headers);
}

function getMatchingItems(items, merchant, deoURL) {

    const matchedItems = [];
    const unmatchedItems = [];
  
    items.forEach(item => { 
      const foundItem = merchant.matchedProducts.find(product => (item.productId === product.deoID && deoURL === product.deoURL));
      if(!foundItem) {
        const image = item.images[0] ?? "";
        unmatchedItems.push({
            quantity: item.quantity,
            product: {
                deoID: item.productId,
                deoURL,
                deoName: item.name,
                deoImage: image
            }
        });
      } else {
        matchedItems.push({ quantity: item.quantity, product: foundItem });
      }
    });
  
    return [ matchedItems, unmatchedItems ];
}

function getAddress(addressType, order) {
    let [firstName, ...lastName] = order.customerName.trim().split(' ')
    lastName = lastName.join(' ')

    return {
        address1: order[addressType].address,
        address2: order[addressType].address2,
        city: order[addressType].city,
        countryCode: order[addressType].country,
        zip: order[addressType].zipCode,
        province: order[addressType].state,
        firstName,
        lastName
    }
}

function getCompleteRequest(draftOrderID) {
    const query = gql`
        mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
            draftOrderComplete(id: $id, paymentPending: $paymentPending) {
                draftOrder {
                    id
                    order {
                        id
                    }
                }
            userErrors {
                field
                    message
                }
            }
        }
    `;

    const variables = { id: draftOrderID, paymentPending: true };
    return [query, variables];
}

async function completeTransaction(paymentMethod, shop, accessToken, orderID) {
    const reqData = {
      transaction: {
        kind: "sale",
        gateway: paymentMethod,
        source: "external"
      }
    };

    //remove the gid shopify prefix
    orderID = orderID.substring(orderID.lastIndexOf('/') + 1);
  
    const config = {
      headers: { 
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      method: "POST",
      body: JSON.stringify(reqData)
    };
  
    const resData = await fetch(`https://${shop}/admin/api/2020-07/orders/${orderID}/transactions.json`, config);
    if(resData.ok) {
        const data = await resData.json();
        logger.http(data);
        return;
    }

    logger.error(resData);
  }

module.exports = Order;