import { useEffect, useState, Fragment, useMemo, useCallback } from "react";
import fetch from "isomorphic-fetch";
import { TitleBar } from "@shopify/app-bridge-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ProductList from "../components/ProductList";
import ProductModal from "../components/ProductModal";
import {
    CalloutCard,
    Card,
    EmptyState,
    Layout,
    Page,
    TextContainer
} from "@shopify/polaris";

function Index({ headers, showToast }) {
    const [items, setItems] = useState(null);
    const [funnelURLs, setFunnelURLs] = useState(null);
    const [calloutActive, setCalloutActive] = useState(true);
    const [modal, setModal] = useState({ active: false, item: null });
    
    useEffect(() => { getMatched(headers, setItems, setFunnelURLs) }, []);

    //Opens the modal with the set item if given
    const openModal = useCallback(item => {
        if(item == null)
            return setModal(prevState => ({ ...prevState, active: true }));

        setModal({ active: true, item });
    }, []);

    //Closes the modal
    const closeModal = useCallback(() => 
        setModal({ active: false, item: null })
    , []);

    /*
    Checks if the modal data valid, makes http request and modifies the list
    */
    const handleSave = useCallback(async item => {
        const isEdit = modal.item !== null;
        const isNotUnique = items.some(product => {
            //If the user edits a product they can set the same
            //deoID when the product has the same _id
            let isNotSelectedItem = true;
            if(isEdit) isNotSelectedItem = item._id !== product._id;
            
            return product.deoID == item.deoID && product.deoURL === item.deoURL && isNotSelectedItem;
        });

        if(isNotUnique) throw new Error("not unique id");
        const fetchConfig = {
            method: isEdit ? "PUT" : "POST",
            body: JSON.stringify(item),
            headers
        };

        const response = await fetch("/api/matched", fetchConfig);
        if(!response.ok) throw new Error(response);
        if(isEdit) {
            //Change in list
            const index = items.findIndex(arrayItem => arrayItem._id === item._id);
            const newItems = [...items];
            newItems[index] = item;
            setItems(newItems);
        } else {
            //Add to list
            const data = await response.json();
            item._id = data.id;
            setItems(prevItems => [...prevItems, item]);
        }
        closeModal();
    }, [items, modal]);

    const handleDelete = useCallback(async id => {
        const config = {
            method: "DELETE",
            body: JSON.stringify({ productID: id }),
            headers
        }

        const response = await fetch("/api/matched", config);
        if(!response.ok) throw new Error(response);
        setItems(prevItems => prevItems.filter(arrItem => arrItem._id !== id));
        closeModal();
    }, []);

    /*
    The renders the callout card
    */
    const calloutJSX = useMemo(() => {
        if(!calloutActive) return null;

        return (
            <CalloutCard
                title="Setup Instructions"
                illustration="/callout.svg"
                primaryAction={{content: "Go to guide", url: "https://google.com", external: true}}
                onDismiss={setCalloutActive.bind(this, false)}
            >
                <TextContainer>
                    If you are new to the app, visit our guide section.
                </TextContainer>
            </CalloutCard>
        );
    }, [calloutActive]);

    /*
    Return the props for the page component
    */
    const pageProps = useMemo(() => {
        if(Array.isArray(items) && items.length)
            return {
                title: "Connect Simvoly products to Shopify products",
                action: {
                    content: "New Product",
                    onAction: openModal.bind(this, null)
                }
            };

            return { title: null, action: null };
    }, [items]);

    /*
    Renders an item list if there are any.
    Otherwise it displays an empty state
    */
    const pageBodyJSX = useMemo(() => {
        if(!Array.isArray(items) || items.length === 0)
            return (
                <Fragment>
                    {calloutJSX}
                    <Card sectioned={true}>
                        <EmptyState
                            heading="Connect products"
                            image="/emptyState.svg"
                            action={{
                                content: "New product",
                                onAction: openModal.bind(this, null)
                            }}
                        >
                            <p>Connect DEO products to their corresponding Shopify products</p>
                        </EmptyState>
                    </Card>
                </Fragment>
            );
        
        return (
            <Layout sectioned={true}>
                <ProductList 
                    isUnmatched={false}
                    items={items}
                    onSelect={openModal}
                    funnels={funnelURLs}
                />
            </Layout>
        );
    }, [items, calloutActive, funnelURLs]);

    //return a loading state if loading items or funnel urls
    if(items === null || funnelURLs === null) return <LoadingSpinner />;

    return (
        <Fragment>
            <TitleBar title="Connect products"/>
            <Page
                title={pageProps.title}
                primaryAction={pageProps.action}
            >
                {pageBodyJSX}
                <ProductModal 
                    active={modal.active}
                    editItem={modal.item}
                    urlOptions={funnelURLs}
                    headers={headers}
                    onClose={closeModal}
                    onSave={handleSave}
                    onDelete={handleDelete}
                    showToast={showToast}
                    isUnmatched={false}
                />
            </Page>
        </Fragment>
    );
}

async function getMatched(headers, setItems, setFunnelURLs) {
    try {
        const response = await fetch("/api/matched", { headers });
        if(!response.ok) throw new Error(response);

        const data = await response.json();
        setItems(data.matchedProducts);
        setFunnelURLs(data.deoURLs);
    } catch (err) {
        console.error(err);
    }
}

export default Index;