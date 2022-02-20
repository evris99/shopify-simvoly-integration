import { useEffect, useState, Fragment, useCallback } from "react";
import fetch from "isomorphic-fetch";
import LoadingSpinner from "../components/LoadingSpinner";
import { TitleBar } from "@shopify/app-bridge-react";
import {
    Page,
    Modal,
    FormLayout,
    TextField,
    IndexTable,
    useIndexResourceState,
    Card,
    Layout
} from "@shopify/polaris";

const defaultModal = {
	active: false,
	deoURL: "",
	apiKey: "",
    loading: false
};

function Setup({ headers, showToast }) {
    const [domains, setDomains] = useState(null);
    const [modal, setModal] = useState(defaultModal);

    useEffect(() => { getDomains(headers, setDomains) }, []);

    //Toggles the modal on and off
    const toggleModal = useCallback(() =>
        setModal(prevModal => ({ ...defaultModal, active: !prevModal.active }))
    , []);

    const handleModalChange = useCallback((field, value) =>
        setModal(prevModal => ({ ...prevModal, [field]: value }))
    , []);

    /*
    Returns JSX for the row in the funnel table
    */
    const getRowMarkup = useCallback(selectedResources => {
        return domains.map(({ _id, deoURL, apiKey }, index) => (
            <IndexTable.Row
                id={_id}
                key={_id}
                selected={selectedResources.includes(_id)}
                position={index}
            >
                <IndexTable.Cell>{deoURL}</IndexTable.Cell>
                <IndexTable.Cell>{apiKey}</IndexTable.Cell>
            </IndexTable.Row>
        ));
    }, [domains]);

    /*
    Makes post http request and updates table
    */
    const handleSave = useCallback(async () => {
        try {
            setModal(prevModal => ({ ...prevModal, loading: true }));
            const { deoURL, apiKey } = modal;
            const fetchConfig = {
                headers,
                method: "POST",
                body: JSON.stringify({ deoURL, apiKey })
            };

            const response = await fetch("/api/domains", fetchConfig);
            if(!response.ok) throw new Error(response);

            const data = await response.json();
            //Add the domain to table
            setDomains(prevDomains => [
                ...prevDomains,
                { _id: data._id, deoURL, apiKey }
            ]);
            setModal(defaultModal);
            showToast("Saved", false);
        } catch(err) {
            if(err.message?.status === 403)
                showToast("The DEO store is already connected to a Shopify store", true);
            else
                showToast("Invalid domain or API key", true);
            console.error(err);
            setModal(prevModal => ({ ...prevModal, loading: false }));
        }
    }, [modal]);

    /*
    Make delete http request and update table
    */
   const handleDelete = useCallback(async selectedResources => {
        try {
            const fetchConfig = {
                headers,
                method: "DELETE",
                body: JSON.stringify(selectedResources)
            };

            const response = await fetch("/api/domains", fetchConfig);
            if(!response.ok) throw new Error(response);

            const selectedItems = [ ...selectedResources ];
            selectedResources.splice(0, selectedResources.length);
            setDomains(prevDomains => prevDomains.filter(domain => !selectedItems.includes(domain._id)));
            showToast("Saved", false);
        } catch(err) {
            showToast("Server error", true);
            console.error(err);
        }
    }, []);

    const {
		selectedResources,
		allResourcesSelected,
		handleSelectionChange
	} = useIndexResourceState(domains, { resourceIDResolver: domain => domain._id });

    if(domains === null) return <LoadingSpinner />;

    const indexTableJSX = (
		<Card>
			<IndexTable
				resourceName={{ singular: "funnel", plural: "funnels" }}
				itemCount={domains.length}
				selectedItemsCount={ allResourcesSelected ? 'All' : selectedResources.length }
				onSelectionChange={handleSelectionChange}
				headings={[
					{ title: 'Funnel domain' },
					{ title: 'Funnel API key' }
				]}
				promotedBulkActions={[
					{ content: "Remove funnels", onAction: handleDelete.bind(this, selectedResources) }
				]}
			>
				{ getRowMarkup(selectedResources) }
			</IndexTable>
		</Card>
	);

    const modalJSX = (
        <Modal
            open={modal.active}
            onClose={toggleModal}
            title="Add new funnel"
            primaryAction={{
                content: "Save",
                onAction: handleSave,
                loading: modal.loading
            }}
            sectioned
        >
            <FormLayout>
                <TextField
                    placeholder="test.simvoly.com"
                    label="Funnel domain"
                    value={modal.deoURL}
                    onChange={handleModalChange.bind(this, "deoURL")}
                />
                <TextField 
                    label="Funnel API key"
                    value={modal.apiKey}
                    onChange={handleModalChange.bind(this, "apiKey")}
                />
            </FormLayout>
        </Modal>
    );

    return (
        <Fragment>
            <TitleBar title="Link DEO funnels"/>
            <Page
                title="Add new funnels"
                primaryAction={{
                    content: "New funnel",
                    onAction: toggleModal
                }}
            >
                <Layout sectioned={true}>
                    {indexTableJSX}
                </Layout>
            </Page>
            {modalJSX}
        </Fragment>
    );
}

async function getDomains(headers, setDomains) {
    try {
        const response = await fetch("/api/domains", { headers });
        if(!response.ok) throw new Error(response);

        const data = await response.json();
        setDomains(data);
    } catch(err) {
        console.error(err);
    }
}

export default Setup;