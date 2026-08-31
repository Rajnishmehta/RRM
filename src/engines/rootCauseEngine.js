async function analyzeRootCause(data) {

    const {
        cart,
        inactiveMinutes,
        paymentErrorCode,
        lastAction
    } = data;


    if (paymentErrorCode) {

        return {
            rootCause:
                "Payment validation failed",

            category:
                "PAYMENT_FAILURE",

            confidence:
                0.95,

            recommendedAction:
                "payment_assistance",

            evidence: [
                `Payment error: ${paymentErrorCode}`
            ]
        };
    }


    if (
        cart.totalValue >= 100 &&
        inactiveMinutes >= 5
    ) {

        return {
            rootCause:
                "High-value checkout requires additional consideration",

            category:
                "HIGH_VALUE_HESITATION",

            confidence:
                0.82,

            recommendedAction:
                "high_value_offer",

            evidence: [
                `Cart value: $${cart.totalValue}`,
                `Inactive for ${inactiveMinutes.toFixed(1)} minutes`
            ]
        };
    }


    if (lastAction === "checkout_exit") {

        return {
            rootCause:
                "Customer exited during checkout",

            category:
                "CHECKOUT_EXIT",

            confidence:
                0.80,

            recommendedAction:
                "checkout_reminder",

            evidence: [
                "Checkout exit event detected"
            ]
        };
    }


    return {

        rootCause:
            "Checkout inactivity",

        category:
            "INACTIVITY",

        confidence:
            0.70,

        recommendedAction:
            "standard_reminder",

        evidence: [
            `Inactive for ${inactiveMinutes.toFixed(1)} minutes`
        ]
    };
}


module.exports = {
    analyzeRootCause
};