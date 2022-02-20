const { createHmac } = require("crypto")

function verifyHmac(signature, secret, rawBody, algorithm) {
    const bodyString = Buffer.from(rawBody, "utf8")
    const hmac = createHmac(algorithm, secret)

    hmac.update(bodyString)
    const digest = hmac.digest("hex")

    return digest === signature
}

module.exports = { verifyHmac };