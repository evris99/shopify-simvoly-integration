import { Spinner } from "@shopify/polaris";

function LoadingSpinner() {

    const style = {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)"
    };
    
    return (
        <div style={style}>
            <Spinner accessibilityLabel="Page Loading" size="large"/>
        </div>
    );
}

export default LoadingSpinner;