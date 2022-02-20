import Head from "next/head";
import { AppProvider } from "@shopify/polaris";
import { Provider, Toast } from "@shopify/app-bridge-react";
import "@shopify/polaris/dist/styles.css";
import translations from "@shopify/polaris/locales/en.json";
import createApp from "@shopify/app-bridge";
import { getSessionToken } from "@shopify/app-bridge-utils";
import { useEffect, useState, useMemo, useCallback } from "react";
import ClientRouter from '../components/ClientRouter';
import LoadingSpinner from '../components/LoadingSpinner';

let config = null;

const defaultToast = {
	active: false,
	content: "",
	error: false
};

function MyApp({ Component, pageProps }) {
	const [headers, setHeaders] = useState(null);
	const [shopOrigin, setShopOrigin] = useState(null);
	const [toast, setToast] = useState(defaultToast);

	useEffect(() => { 
		let urlParams
		if(typeof window !== "undefined") {
			urlParams = new URLSearchParams(window.location.search);
			setShopOrigin(urlParams.get('shop'));
		}

		config = {
			apiKey: API_KEY,
			shopOrigin: urlParams.get('shop'),
			forceRedirect: true
		};

		getHeaders(config, setHeaders) 
	}, []);

	const showToastMessage = useCallback((message, error) => 
		setToast({ active: true, content: message, error })
	, []);

	const toastJSX = useMemo(() => {
		if(!toast.active) return null;
		return (
			<Toast
				content={toast.content}
				error={toast.error}
				onDismiss={setToast.bind(this, defaultToast)}
			/>
		);
	}, [toast]);

	if(shopOrigin == null) return <LoadingSpinner />;

	const pageBody = headers ? (
		<Component headers={headers} showToast={showToastMessage} {...pageProps} />
	) : (
		<LoadingSpinner />
	);

	return (
		<>
			<Head>
				<title>DEO integration</title>
				<meta charSet="utf-8" />
			</Head>
			<Provider config={config}>
				<ClientRouter />
				<AppProvider i18n={translations}>
					{pageBody}
					{toastJSX}
				</AppProvider>
			</Provider>
		</>
	);
}

async function getHeaders(config, setHeaders) {
	try {
		const app = createApp(config);
		const token = await getSessionToken(app);
		setHeaders({ "Authorization": "Bearer " + token, "Content-Type": "application/json" });
	} catch(err) {
		console.error(err);
	}
}

export default MyApp;
