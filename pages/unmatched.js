import { useState, useEffect, useMemo, useCallback, Fragment } from "react";
import fetch from "isomorphic-fetch";
import { TitleBar } from "@shopify/app-bridge-react";
import LoadingSpinner from "../components/LoadingSpinner";
import ProductList from "../components/ProductList";
import ProductModal from "../components/ProductModal";
import {
    Card,
    Page,
    EmptyState,
    Layout
} from "@shopify/polaris";

function Unmatched({ headers, showToast }) {
    const [items, setItems] = useState(null);
    const [modal, setModal] = useState({ active: false, item: null });

    useEffect(() => { getUnmatched(headers, setItems) }, []);

    //Opens the modal with the set item if given
    const openModal = useCallback(item => 
        setModal({ active: true, item })
    , []);

    //Closes the modal
    const closeModal = useCallback(() => 
        setModal({ active: false, item: null })
    , []);

    /*
    Checks if the modal data valid, makes http request and modifies the list
    */
    const handleSave = useCallback(async item => {
        const config = {
            method: "POST",
            body: JSON.stringify(item),
            headers
        };

        const response = await fetch("/api/unmatched", config);
        if(!response.ok) throw new Error(response);

        setItems(prevItems => prevItems.filter(it => it._id.toString() !== item._id.toString()));
        closeModal();
    }, []);

    const areNoItems = useMemo(() => 
        !Array.isArray(items) || items.length === 0
    , [items]);

    /*
    Return the page title if not displaying empty state
    */
    const pageTitle = useMemo(() => {
        if(areNoItems) return null;
        return "Connect unmatched DEO products with Shopify products"
    }, [items]);


    /*
    Renders an item list if there are any.
    Otherwise it displays an empty state
    */
    const pageBodyJSX = useMemo(() => {
        if(areNoItems)
            return (
                <Card sectioned={true}>
                    <EmptyState
                        heading="No unmatched products"
                        image="/emptyState.svg"
                    >
                        <p>You do not have any products that require matching</p>
                    </EmptyState>
                </Card>
            );

        return (
            <Layout sectioned={true}>
                <ProductList 
                    isUnmatched={true}
                    items={items}
                    onSelect={openModal}
                    funnels={null}
                />
            </Layout>
        );
    }, [items]);

    if(items === null) return <LoadingSpinner />;

    return (
        <Fragment>
            <TitleBar title="Connect unmatched products"/>
            <Page title={pageTitle}>
                {pageBodyJSX}
                <ProductModal
                    active={modal.active}
                    editItem={modal.item}
                    urlOptions={null}
                    headers={headers}
                    onClose={closeModal}
                    onSave={handleSave}
                    showToast={showToast}
                    isUnmatched={true}
                />
            </Page>
        </Fragment>
    );
}

async function getUnmatched(headers, setItems) {
    try {
        const response = await fetch("/api/unmatched", { headers });
        if(!response.ok) throw new Error(response);

        const data = await response.json();
        setItems(data);
    } catch(err) {
        console.error(err);
    }
}

export default Unmatched;