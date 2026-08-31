const {
    getCustomerInterventions
} = require("./analyticsService");


// ============================================================
// COMPLIANCE CONFIGURATION
// ============================================================

const MAX_MESSAGES = 3;

const WINDOW_DAYS = 7;


// SMS allowed between 9 AM and 8 PM

const SMS_START_HOUR = 9;

const SMS_END_HOUR = 20;


// ============================================================
// DEVELOPMENT MODE
// ============================================================
//
// For local testing only:
//
// COMPLIANCE_BYPASS=true
//
// This allows us to test the complete recovery pipeline
// without being blocked by SMS time restrictions.
//
// IMPORTANT:
// Never enable this in production.
//
// ============================================================

const COMPLIANCE_BYPASS =
    String(
        process.env.COMPLIANCE_BYPASS || ""
    ).toLowerCase() === "true";


// ============================================================
// CHECK COMPLIANCE
// ============================================================

async function checkCompliance({

    customerId,

    channel,

    consent = true

}) {

    const reasons = [];


    // ========================================================
    // DEVELOPMENT BYPASS
    // ========================================================

    if (COMPLIANCE_BYPASS) {

        return {

            allowed: true,

            bypassed: true,

            reasons: [

                "Development compliance bypass enabled"

            ],

            recentMessages: 0

        };

    }


    // ========================================================
    // CONSENT
    // ========================================================

    if (!consent) {

        reasons.push(
            "Customer has not provided marketing consent"
        );


        return {

            allowed: false,

            reasons

        };

    }


    // ========================================================
    // CHANNEL VALIDATION
    // ========================================================

    const allowedChannels = [

        "email",
        "sms",
        "push",
        "in_app"

    ];


    if (
        !allowedChannels.includes(channel)
    ) {

        reasons.push(
            "Unsupported communication channel"
        );


        return {

            allowed: false,

            reasons

        };

    }


    // ========================================================
    // CUSTOMER MESSAGE HISTORY
    // ========================================================

    const interventions =
        await getCustomerInterventions(
            customerId
        );


    const cutoff =
        new Date(

            Date.now() -

            WINDOW_DAYS *
            24 *
            60 *
            60 *
            1000

        );


    const recentMessages =
        interventions.filter(

            intervention =>

                new Date(
                    intervention.sentAt
                ) >= cutoff

        );


    // ========================================================
    // FREQUENCY LIMIT
    // ========================================================

    if (
        recentMessages.length >=
        MAX_MESSAGES
    ) {

        reasons.push(

            `Maximum ${MAX_MESSAGES} messages in ${WINDOW_DAYS} days reached`

        );


        return {

            allowed: false,

            reasons,

            recentMessages:
                recentMessages.length

        };

    }


    // ========================================================
    // SMS TIME RESTRICTION
    // ========================================================

    if (
        channel === "sms"
    ) {

        const hour =
            new Date().getHours();


        if (

            hour <
            SMS_START_HOUR

            ||

            hour >=
            SMS_END_HOUR

        ) {

            reasons.push(

                "SMS is blocked outside permitted hours"

            );


            return {

                allowed: false,

                reasons,

                recentMessages:
                    recentMessages.length

            };

        }

    }


    // ========================================================
    // COMPLIANCE PASSED
    // ========================================================

    return {

        allowed: true,

        bypassed: false,

        reasons: [

            "Consent verified",

            "Channel allowed",

            "Frequency limit passed"

        ],

        recentMessages:
            recentMessages.length

    };

}


// ============================================================
// EXPORT
// ============================================================

module.exports = {

    checkCompliance

};