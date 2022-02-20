import fetch from "isomorphic-fetch";
import { useEffect, useState, useCallback, useMemo } from "react";
import { 
    Modal,
    ResourceList,
    ResourceItem,
    Thumbnail,
    TextStyle,
    Stack,
    Pagination
} from "@shopify/polaris";

const pageSize = 10;

function DeoPicker({ headers, funnel, active, onClose, onSelect }) {

    /*
    The items object has the form { total: Number, products: Array of products }
    */
    const [items, setItems] = useState(null);
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(null);

    useEffect(() => {
        if(active) {
            getItems(headers, funnel, page, setItems, setTotalItems);
        } else {
            setItems(null);
            setPage(1);
            setTotalItems(null);
        }
    }, [active]);

    const renderItem = useCallback(item => {
        const {id, image, title} = item;
        const thumbnail = <Thumbnail source={image}></Thumbnail>

        return (
            <ResourceItem
                id={id}
                media={thumbnail}
                onClick={onSelect.bind(this, id, title)}
            >
                <h3>
                    <TextStyle variation="strong">{title}</TextStyle>
                </h3>
            </ResourceItem>
        );
    }, [onSelect]);

    /*
    A function to get the next or previous page
    */
    const handlePagination = useCallback(async type => {
        setItems(null);

        let newPage;
        switch(type) {
            case "next":
                newPage = page + 1;
                break;
            case "previous":
                newPage = page - 1;
                break;
            default:
                throw new Error("Invalid pagination type");
        }

        const config = {
            headers,
            method: "POST",
            body: JSON.stringify({
                page: newPage,
                funnelURL: funnel
            })
        };

        try {
            const response = await fetch("/api/deo_products", config);
            if(!response.ok) throw new Error(response);

            const data = await response.json();
            setPage(newPage);
            setItems(data.products);
        } catch(err) {
            console.error(err);
        }
    }, [page, funnel]);

    const hasNext = useMemo(() => pageSize * page < totalItems, [pageSize, page, totalItems])

    return (
        <Modal
            title="Select product"
            open={active}
            onClose={onClose}
            loading={items == null}
            instant
            large
        >
            <Modal.Section>
                <ResourceList
                    resourceName={{singular: "product", plural: "products"}}
                    items={items}
                    renderItem={renderItem}
                />
            </Modal.Section>
            <Modal.Section>
                <Stack distribution="center">
                    <Pagination
                        hasPrevious={page !== 1}
                        onPrevious={handlePagination.bind(this, "previous")}
                        hasNext={hasNext}
                        onNext={handlePagination.bind(this, "next")}
                    />
                </Stack>
            </Modal.Section>
        </Modal>
    );
}

async function getItems(headers, funnel, page, setItems, setTotalItems) {

    const fetchConfig = {
        headers,
        method: "POST",
        body: JSON.stringify({
            page,
            funnelURL: funnel
        })
    };

    try {
        const response = await fetch("/api/deo_products", fetchConfig);
        if(!response.ok) throw new Error(response);
        const data = await response.json();

        setItems(data.products);
        setTotalItems(data.total);
    } catch (err) {
        if(err.message.status == null || err.message.status !== 405)
            console.error(err);
    }
}

export default DeoPicker;