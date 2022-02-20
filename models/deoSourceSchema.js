const { Schema } = require("mongoose");

const deoSourceSchema = Schema({
    deoURL: String,
    apiKey: String,
    webhookSecret: String,
    webhookID: String
})

module.exports = deoSourceSchema;