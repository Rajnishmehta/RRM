const {
    chooseChannel
} = require("./thompsonSampling");


// ============================================================
// RecoverIQ - Recovery Decision Engine
// ============================================================
//
// Determines:
//
// 1. Control vs Treatment
// 2. Recovery channel
// 3. Offer type
// 4. Discount
// 5. Recovery priority
//
// ============================================================


// ============================================================
// CONTROL GROUP
// ============================================================

function randomControlGroup() {

    // Development override
    if (
        String(
            process.env.FORCE_TREATMENT || ""
        ).toLowerCase() === "true"
    ) {

        return false;

    }


    // Production experiment:
    // 10% control group

    return Math.random() < 0.10;

}


// ============================================================
// MAIN DECISION FUNCTION
// ============================================================

async function decideRecovery({

    session,

    cart,

    rootCause

}) {

    if (!session) {

        throw new Error(
            "Session is required"
        );

    }


    if (!cart) {

        throw new Error(
            "Cart is required"
        );

    }


    const cartValue =
        Number(
            cart.totalValue || 0
        );


    const clv =
        Number(
            session.clv || 0
        );


    const rootCauseCategory =
        rootCause?.category ||
        "INACTIVITY";


    // ========================================================
    // CONTROL GROUP
    // ========================================================

    const isControlGroup =
        randomControlGroup();


    if (isControlGroup) {

        return {

            isControlGroup: true,

            channel: "none",

            offerType: "none",

            discountDepth: 0,

            reason:
                "Customer randomly assigned to 10% control group",

            rootCauseCategory,

            priority: "none"

        };

    }


    // ========================================================
    // SELECT CHANNEL
    // ========================================================

    const channel =
        await chooseChannel();


    // ========================================================
    // PAYMENT FAILURE
    // ========================================================

    if (
        rootCauseCategory ===
        "PAYMENT_FAILURE"
    ) {

        return {

            isControlGroup: false,

            channel,

            offerType:
                "payment_assistance",

            discountDepth: 0,

            reason:
                "Payment failure detected",

            rootCauseCategory,

            priority:
                "high"

        };

    }


    // ========================================================
    // HIGH VALUE CUSTOMER
    // ========================================================

    if (
        cartValue >= 100 &&
        clv >= 1000
    ) {

        return {

            isControlGroup: false,

            channel,

            offerType:
                "premium_recovery",

            discountDepth: 10,

            reason:
                "High-value cart and high customer lifetime value",

            rootCauseCategory,

            priority:
                "high"

        };

    }


    // ========================================================
    // HIGH VALUE CART
    // ========================================================

    if (
        cartValue >= 100
    ) {

        return {

            isControlGroup: false,

            channel,

            offerType:
                "cart_discount",

            discountDepth: 10,

            reason:
                "High-value cart",

            rootCauseCategory,

            priority:
                "medium"

        };

    }


    // ========================================================
    // CHECKOUT EXIT
    // ========================================================

    if (
        rootCauseCategory ===
        "CHECKOUT_EXIT"
    ) {

        return {

            isControlGroup: false,

            channel,

            offerType:
                "checkout_reminder",

            discountDepth: 5,

            reason:
                "Customer exited during checkout",

            rootCauseCategory,

            priority:
                "medium"

        };

    }


    // ========================================================
    // DEFAULT
    // ========================================================

    return {

        isControlGroup: false,

        channel,

        offerType:
            "standard_reminder",

        discountDepth: 5,

        reason:
            "Standard abandonment recovery",

        rootCauseCategory,

        priority:
            "low"

    };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    decideRecovery

};