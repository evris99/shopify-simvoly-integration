import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import ItemPicker from "./ItemPicker";
import {
    Modal,
    TextField,
    ChoiceList,
    RangeSlider,
    TextStyle,
    Select,
    Stack
} from "@shopify/polaris";

//Return the default item
function getDefaultItem(urlOptions) {
    const deoURL = urlOptions == null || !Array.isArray(urlOptions) ? "" : urlOptions[0];
    return {
        shopifyID: null,
        name: null,
        variantName: "Default Title",
        image: "",
        deoID: null,
        deoURL: deoURL,
        deoName: null,
        quantity: 1,
        discount: {
            discountType: "PERCENTAGE",
            discountValue: 0
        }
    };
}

function productReducer(state, action) {
    switch(action.type) {
        case "whole":
            return { ...state, ...action.value };
        case "quantity":
            if(action.value < 1) action.value = 1;
            return { 
                ...state,
                quantity: parseInt(action.value)
            };
        case "funnel":
            return {
                ...state,
                deoURL: action.value
            };
        case "deoItem":
            return {
                ...state,
                deoID: parseInt(action.value.id, 10),
                deoName: action.value.name
            };
        case "shopifyItem":
            return {
                ...state,
                shopifyID: action.value.id,
                name: action.value.name,
                variantName: action.value.variant,
                image: action.value.image
            };
        case "discount_type":
            return {
                ...state,
                discount: {
                    discountValue: 0,
                    discountType: action.value[0]
                }
            };
        case "discount_value":
            return {
                ...state,
                discount: {
                    discountType: state.discount.discountType,
                    discountValue: action.value
                }
            };
        case "discount_blur":
            return {
                ...state,
                discount: {
                    discountType: state.discount.discountType,
                    discountValue: parseFloat(parseFloat(state.discount.discountValue).toFixed(2))
                }
            }
        default:
            throw new Error("Invalid type in react reducer");
    }
}

function ProductModal({ active, editItem, urlOptions, headers, onClose, onSave, onDelete, showToast }) {
    const [item, itemDispatch] = useReducer(productReducer, getDefaultItem(urlOptions));
    const [loading, setLoading] = useState({ primary: false, secondary: false });

    /*
    Set the item to the selected or default
    */
    useEffect(() => {
        if(editItem != null)
            itemDispatch({ type: "whole", value: editItem });
        else
            itemDispatch({ type: "whole", value: getDefaultItem(urlOptions) });
    }, [editItem, active, urlOptions]);

    /*
    Run the prop save function and handles any error
    */
    const handleSave = useCallback(async () => {
        try {
            //Start loading spinner
            setLoading(prevState => ({ ...prevState, primary: true }));
            await onSave(item);
            itemDispatch({ type: "whole", value: getDefaultItem(urlOptions) });
            showToast("Saved", false);
        } catch(err) {
            let message;
            switch(err.message) {
                case "not unique id":
                    message = "The Simvoly product must be unique";
                    break;
                default:
                    message = "Could not save changes";
            }
            showToast(message, true);
        } finally {
            //Stop loading spinner
            setLoading(prevState => ({ ...prevState, primary: false }));
        }
    }, [item, urlOptions]);

     /*
    Run the prop delete function and handles any error
    */
    const handleDelete = useCallback(async () => {
        try {
            //Start loading spinner
            setLoading(prevState => ({ ...prevState, secondary: true }));
            await onDelete(item._id);
            itemDispatch({ type: "whole", value: getDefaultItem(urlOptions) })
            showToast("Deletion successful", false);
        } catch(err) {
            showToast("Could not delete product", true);
        } finally {
            //Stop loading spinner
            setLoading(prevState => ({ ...prevState, secondary: false }))
        }
    }, [item, urlOptions]);

    /*
    Set the item as the default item and call onClose prop
    */
    const handleClose = useCallback(() => {
        itemDispatch({ type: "whole", value: getDefaultItem(urlOptions) });
        onClose();
    }, [urlOptions]);

    /*
    Calls the corresponding dispatch
    */
    const handlePickerSelection = useCallback((platf, itemProperties) => {
        switch(platf) {
            case "shopify":
                itemDispatch({ type: "shopifyItem", value: itemProperties });
                break;
            case "deo":
                itemDispatch({ type: "deoItem", value: itemProperties });
                break;
            default:
                throw new Error("invalid platform");
        }
    }, []);

    /*
    Returns true if there the merchant has not matched funnels
    */
    const hasNoFunnel = useMemo(() => Array.isArray(urlOptions) && urlOptions.length === 0, [urlOptions]);

    /*
    Returns true if the product is unmatched
    */
    const isUnmatched = useMemo(() => urlOptions === null);

    /*
    An object to be used as modal props
    */
    const deleteAction = useMemo(() => {
        if(editItem == null || isUnmatched) return null;
        
        return {
            content: "Delete",
            onAction: handleDelete,
            destructive: true,
            loading: loading.secondary
        };
    }, [editItem, item, loading]);

    /*
    Returns a select input element for selecting the products funnel
    */
    const deoURLJSX = useMemo(() => {
        if(hasNoFunnel)
            return (
                <Stack distribution="center">
                    <TextStyle variation="negative">You must first add a DEO domain in Setup</TextStyle>
                </Stack>
            );

        let options = urlOptions;
        if(options == null)
            options = item.deoURL ? [item.deoURL] : null;

        return (
            <Select
                label="Funnel URL"
                options={options}
                disabled={isUnmatched}
                value={item.deoURL}
                onChange={value => itemDispatch({ type: "funnel", value })}
            />
        );
    }, [urlOptions, item]);

    /*
    Returns a slider if the discount is percentage or
    a text input field if the discount is fixed
    */
    const discountValueJSX = useMemo(() => {
        switch(item.discount.discountType) {
            case "FIXED_AMOUNT":
                return (
                    <TextField
                        label="Discount price"
                        type="number"
                        value={String(item.discount.discountValue)}
                        onChange={value => itemDispatch({ type: "discount_value", value })}
                        onBlur={() => itemDispatch({ type: "discount_blur" })}
                    />
                );
            case "PERCENTAGE":
                return (
                    <RangeSlider
                        label="Discount percentage"
                        value={item.discount.discountValue}
                        onChange={value => itemDispatch({ type: "discount_value", value })}
                        suffix={<p style={{minWidth: '24px', textAlign: 'right'}}>{item.discount.discountValue}%</p>}
                    />
                );
            default:
                throw new Error("Invalid discount type");
        }
    }, [item]);

    return (
        <Modal
            open={active}
            onClose={handleClose}
            title="Match Shopify products to Simvoly products"
            primaryAction={{
                content: "Save",
                disabled: item.deoID == null || item.shopifyID == null,
                onAction: handleSave,
                loading: loading.primary
            }}
            secondaryActions={deleteAction}
        >
            <Modal.Section>
                {deoURLJSX}
            </Modal.Section>
            <Modal.Section>
                <ItemPicker
                    platf="shopify"
                    item={{
                        id: item.shopifyID,
                        name: item.name,
                        variant: item.variantName,
                        image: item.image
                    }}
                    onSelect={handlePickerSelection}
                    showToast={showToast}
                />
            </Modal.Section>
            <Modal.Section>
                <ItemPicker
                    platf="deo"
                    disabled={hasNoFunnel || isUnmatched}
                    item={{
                        id: item.deoID,
                        name: item.deoName
                    }}
                    headers={headers}
                    funnel={item.deoURL}
                    onSelect={handlePickerSelection}
                />
            </Modal.Section>
            <Modal.Section>
                <TextField
                    label="Quantity"
                    type="number"
                    value={String(item.quantity)}
                    onChange={value => itemDispatch({ type: "quantity", value })}
                />
            </Modal.Section>
            <Modal.Section>
                <ChoiceList 
                    title="Set discount type"
                    choices={[
                        { label: "Percentage", value: "PERCENTAGE" },
                        { label: "Fixed", value: "FIXED_AMOUNT" }
                    ]}
                    selected={[item.discount.discountType]}
                    onChange={value => itemDispatch({ type: "discount_type", value })}
                />
            </Modal.Section>
            <Modal.Section>
                {discountValueJSX}
            </Modal.Section>
        </Modal>
    );
}

export default ProductModal;