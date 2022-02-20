# Simvoly Shopify Integration

A shopify app that connects your [Simvoly](https://simvoly.com) page builder orders to [Shopify](https://www.shopify.com). The app can be installed in your store from the [Shopify App Store](https://apps.shopify.com/deo-integration). Alternatively it can be self hosting with your own infrastructure.

## Deploying in your own hardware

To deploy, clone this repository and install the depedencies by running:
```
npm install
```

Then copy the example configuration.
```
cp .env.example .env
```
Change the API_KEY and API_SECRET_KEY to your own keys from Shopify. Set the MY_DOMAIN to your domain that must have TLS enabled and the DATABASE_URL to your own MongoDB instance.

To start run:
```
npm start
```

## Contributing

All contributions and pull requests are welcome.