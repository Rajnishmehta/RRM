// ------------------------------------------------------------
// Simulated multi-channel dispatcher
// ------------------------------------------------------------


async function sendEmail({
    customerId,
    offerType,
    discountDepth
}) {

    console.log(
        `[EMAIL] Sending recovery message to customer ${customerId}`
    );

    console.log(
        `[EMAIL] Offer: ${offerType}`
    );

    console.log(
        `[EMAIL] Discount: ${discountDepth}%`
    );


    return {

        success: true,

        provider:
            "mock-email-provider",

        messageId:
            `email_${Date.now()}`,

        channel: "email"
    };
}


// ------------------------------------------------------------


async function sendSMS({
    customerId,
    offerType,
    discountDepth
}) {

    console.log(
        `[SMS] Sending recovery message to customer ${customerId}`
    );

    console.log(
        `[SMS] Offer: ${offerType}`
    );

    console.log(
        `[SMS] Discount: ${discountDepth}%`
    );


    return {

        success: true,

        provider:
            "mock-sms-provider",

        messageId:
            `sms_${Date.now()}`,

        channel: "sms"
    };
}


// ------------------------------------------------------------


async function sendPush({
    customerId,
    offerType,
    discountDepth
}) {

    console.log(
        `[PUSH] Sending recovery notification to customer ${customerId}`
    );

    console.log(
        `[PUSH] Offer: ${offerType}`
    );

    console.log(
        `[PUSH] Discount: ${discountDepth}%`
    );


    return {

        success: true,

        provider:
            "mock-push-provider",

        messageId:
            `push_${Date.now()}`,

        channel: "push"
    };
}


// ------------------------------------------------------------


async function sendInApp({
    customerId,
    offerType,
    discountDepth
}) {

    console.log(
        `[IN-APP] Showing recovery message to customer ${customerId}`
    );


    return {

        success: true,

        provider:
            "internal-in-app",

        messageId:
            `inapp_${Date.now()}`,

        channel: "in_app"
    };
}


// ------------------------------------------------------------
// Main dispatcher
// ------------------------------------------------------------

async function dispatch({
    channel,
    customerId,
    offerType,
    discountDepth
}) {

    const payload = {

        customerId,

        offerType,

        discountDepth
    };


    switch (channel) {

        case "email":

            return await sendEmail(
                payload
            );


        case "sms":

            return await sendSMS(
                payload
            );


        case "push":

            return await sendPush(
                payload
            );


        case "in_app":

            return await sendInApp(
                payload
            );


        case "none":

            return {

                success: true,

                provider: "control-group",

                messageId: null,

                channel: "none"
            };


        default:

            throw new Error(
                `Unsupported channel: ${channel}`
            );
    }
}


module.exports = {
    dispatch,
    sendEmail,
    sendSMS,
    sendPush,
    sendInApp
};