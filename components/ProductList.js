import { useCallback, useState } from "react";
import {
    ResourceList,
    ResourceItem,
    Card,
    Thumbnail,
    Stack,
    TextStyle,
    Filters,
    ChoiceList
} from "@shopify/polaris";

function ProductList({ items, isUnmatched, onSelect, funnels }) {
    const [funnel, setFunnel] = useState(null);
    
    /*
    A function to render each item in list
    */
    const handleItemRender = useCallback(item => {
        
        if(isUnmatched) {
            const media = <Thumbnail source={item.deoImage} />;
            return (
                <ResourceItem
                    id={item._id}
                    onClick={onSelect.bind(this, item)}
                    media={media}
                >
                    <h3>
                        <TextStyle variation="strong">{item.deoName}</TextStyle>
                    </h3>
                    <div>
                        <Stack distribution="center">
                            <h4>from {item.deoURL}</h4>
                        </Stack>
                    </div>
                </ResourceItem>
            );
        }

        const media = <Thumbnail source={item.image}/>;
        const discountJSX = item.discount.discountType === "PERCENTAGE" ? (
            <h4>Percentage discount: {item.discount.discountValue}%</h4>
        ) : (
            <h4>Fixed discount: {item.discount.discountValue}</h4>
        );

        return (
            <ResourceItem
                id={item._id}
                onClick={onSelect.bind(this, item)}
                media={media}
            >
                <h3>
                    <TextStyle variation="strong">{item.name}</TextStyle>
                </h3>
                <div>
                    <Stack distribution="fill">
                        <h4>Matched to {item.deoName}</h4>
                        <h4>x{item.quantity}</h4>
                        <h4>from {item.deoURL}</h4>
                        {discountJSX}
                    </Stack>
                </div>
            </ResourceItem>
        );
    }, [items, isUnmatched]);

    const handleChoiceChange = useCallback(value => 
        setFunnel(value[0])
    , []);

    let filterProps = null;
    if(funnels != null) {

        const filter = [{
            key: "funnel",
            label: "Funnel",
            filter: (
                <ChoiceList
                    title="Funnel"
                    titleHidden
                    choices={funnels.map(funnel => ({ label: funnel, value: funnel }))}
                    selected={[funnel] || []}
                    onChange={handleChoiceChange}
                />
            ),
            shortcut: true,
            hideClearButton: true
        }];

        const appliedFilters = [];
        if(funnel != null)
            appliedFilters.push({
                label: "funnel",
                key: "funnel",
                onRemove: () => setFunnel(null)
            });


        filterProps =  (
            <Filters
                appliedFilters={appliedFilters}
                queryValue={funnel}
                filters={filter}
                onQueryClear={() => setFunnel(null)}
                onClearAll={() => setFunnel(null)}
                hideQueryField
            />
        );
    }

    

    const displayItems = funnel == null ? items : items.filter(it => it.deoURL === funnel);

    return (
        <Card>
            <ResourceList 
                resourceName={{singular: "product", plural: "products"}}
                items={displayItems}
                renderItem={handleItemRender}
                filterControl={filterProps}
            />
        </Card>
    );
}

export default ProductList;