import { useState, useCallback, useMemo, Fragment } from "react";
import { ResourcePicker } from "@shopify/app-bridge-react";
import DeoPicker from "./DeoPicker";
import {
    Button,
    Stack,
    TextStyle,
    Thumbnail
} from "@shopify/polaris";

const defaultItemImage = "/ImageMajor.svg";

/*
The item object is in the form of 
{
    id,
    name,
    variant,
    image
}
*/
function ItemPicker({ platf, item, headers, funnel, onSelect, disabled, showToast }) {
    const [pickerActive, setPickerActive] = useState(false);

    /*
    Calls onSelect function from props shows an error modal if
    there are more than one variants
    */
    const handleSelection = useCallback((...args) => {
        let itemProperties;
        switch(platf) {
            case "shopify":
                const selection = args[0].selection[0];
                const imageSource = selection.images.length ? selection.images[0].originalSrc : defaultItemImage;

                //Check if the user selected more than one variants
                if(selection.variants.length !== 1) {
                    showToast("Invalid number of variants", true);
                    return setPickerActive(false);
                }

                itemProperties = {
                    id: selection.variants[0].id,
                    name: selection.title,
                    image: imageSource,
                    variant: selection.variants[0].title
                };
                break;
            case "deo":
                itemProperties = {
                    id: args[0],
                    name: args[1]
                };
                break;
            default:
                throw new Error("invalid platf");
        }

        onSelect(platf, itemProperties);
        setPickerActive(false);
    }, [onSelect, platf]);

    /*
    Returns the corresponding Picker according to the platform
    */
    const platformPicker = useMemo(() => {
        switch(platf) {
            case "shopify":
                return (
                    <ResourcePicker 
                        resourceType="Product"
                        showVariants={true}
                        open={pickerActive}
                        allowMultiple={false}
                        onCancel={setPickerActive.bind(this, false)}
                        onSelection={handleSelection}
                    />
                );
            case "deo":
                return (
                    <DeoPicker 
                        active={pickerActive}
                        headers={headers}
                        funnel={funnel}
                        onSelect={handleSelection}
                        onClose={setPickerActive.bind(this, false)}
                    />
                );
            default:
                throw new Error("invalid platform");
        }
    }, [platf, pickerActive]);

    const itemTextJSX = useMemo(() => {
        if(item.name == null)
            return { variation: "subdued", text: "No product chosen" };
        
        return { variation: "strong", text: item.name };
    }, [item.name]);

    const variantJSX = useMemo(() => {
        if(item.variant == null || item.variant === "Default Title")
            return null;

        return <TextStyle variation="strong">{item.variant}</TextStyle>;    
    }, [item.variant]);

    /*
        const imageJSX = useMemo(() => {
            if(item.image == null) return null;
            return <Thumbnail source={item.image}></Thumbnail>;
        }, [item.image]);
    */

    return (
        <Fragment>
            <Stack distribution="fill">
                <Button disabled={disabled} primary onClick={setPickerActive.bind(this, true)}>Choose {platf} product</Button>
                <Stack vertical={true}>
                    <TextStyle variation={itemTextJSX.variation}>{itemTextJSX.text}</TextStyle>
                    {variantJSX}
                </Stack>
                {
                    //imageJSX
                }
            </Stack>
            {platformPicker}
        </Fragment>
    );
}

export default ItemPicker;