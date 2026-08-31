const { prisma } = require("../config/prisma");


/*
|--------------------------------------------------------------------------
| SESSION
|--------------------------------------------------------------------------
*/

async function createSession(data) {

    return await prisma.session.create({
        data: {
            sessionId: data.sessionId,
            customerId: data.customerId,

            device:
                data.device ||
                "Unknown",

            geo:
                data.geo ||
                "Unknown",

            trafficSource:
                data.trafficSource ||
                "Direct",

            startTime:
                data.startTime
                    ? new Date(data.startTime)
                    : new Date(),

            lastActivity:
                new Date(),

            clv:
                Number(data.clv || 0),

            status:
                "active"
        }
    });
}


async function getSession(sessionId) {

    return await prisma.session.findUnique({
        where: {
            sessionId
        }
    });
}


async function updateSession(
    sessionId,
    data
) {

    return await prisma.session.update({
        where: {
            sessionId
        },

        data
    });
}


/*
|--------------------------------------------------------------------------
| CART
|--------------------------------------------------------------------------
*/

async function createCart(data) {

    return await prisma.cart.create({
        data: {

            cartId:
                data.cartId,

            sessionId:
                data.sessionId,

            items:
                data.items || [],

            totalValue:
                Number(
                    data.totalValue || 0
                ),

            categories:
                data.categories || [],

            createdAt:
                new Date()
        }
    });
}


async function getCart(sessionId) {

    return await prisma.cart.findUnique({
        where: {
            sessionId
        }
    });
}


async function updateCart(
    sessionId,
    data
) {

    return await prisma.cart.update({
        where: {
            sessionId
        },

        data
    });
}


/*
|--------------------------------------------------------------------------
| ABANDONMENT CONTEXT
|--------------------------------------------------------------------------
*/

async function createContext(data) {

    return await prisma.abandonmentContext.create({
        data: {

            contextId:
                data.contextId,

            sessionId:
                data.sessionId,

            lastAction:
                data.lastAction ||
                null,

            timeAtCheckout:
                data.timeAtCheckout
                    ? new Date(
                        data.timeAtCheckout
                    )
                    : new Date(),

            paymentErrorCode:
                data.paymentErrorCode ||
                null,

            rootCauseNotes:
                data.rootCauseNotes ||
                null
        }
    });
}


async function getLatestContext(
    sessionId
) {

    return await prisma.abandonmentContext.findFirst({

        where: {
            sessionId
        },

        orderBy: {
            timeAtCheckout:
                "desc"
        }
    });
}


/*
|--------------------------------------------------------------------------
| INTERVENTION
|--------------------------------------------------------------------------
*/

async function createIntervention(
    data
) {

    return await prisma.intervention.create({

        data: {

            interventionId:
                data.interventionId,

            sessionId:
                data.sessionId,

            customerId:
                data.customerId,

            channel:
                data.channel,

            offerType:
                data.offerType,

            discountDepth:
                Number(
                    data.discountDepth || 0
                ),

            sentAt:
                new Date(),

            status:
                data.status ||
                "sent",

            isControlGroup:
                Boolean(
                    data.isControlGroup
                ),

            convertedValue:
                Number(
                    data.convertedValue || 0
                )
        }
    });
}


async function getIntervention(
    interventionId
) {

    return await prisma.intervention.findUnique({

        where: {
            interventionId
        }
    });
}


async function updateIntervention(
    interventionId,
    data
) {

    return await prisma.intervention.update({

        where: {
            interventionId
        },

        data
    });
}


async function getCustomerInterventions(
    customerId
) {

    return await prisma.intervention.findMany({

        where: {
            customerId
        },

        orderBy: {
            sentAt:
                "desc"
        }
    });
}


/*
|--------------------------------------------------------------------------
| RECORD CONVERSION
|--------------------------------------------------------------------------
|
| This function:
|
| 1. Finds the latest intervention for the session
| 2. Marks it as converted
| 3. Stores conversion revenue
| 4. Marks the session as recovered
| 5. Updates Thompson Sampling
|
|--------------------------------------------------------------------------
*/

async function recordConversion(
    sessionId,
    conversionValue
) {

    const value =
        Number(
            conversionValue || 0
        );


    if (value < 0) {

        throw new Error(
            "Conversion value cannot be negative"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Find latest intervention
    |--------------------------------------------------------------------------
    */

    const intervention =
        await prisma.intervention.findFirst({

            where: {
                sessionId
            },

            orderBy: {
                sentAt:
                    "desc"
            }
        });


    if (!intervention) {

        throw new Error(
            "No intervention found for this session"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Control group
    |--------------------------------------------------------------------------
    |
    | Control users do not receive an intervention,
    | but if a conversion is simulated against a
    | control record, we still record the conversion.
    |
    |--------------------------------------------------------------------------
    */

    const updatedIntervention =
        await prisma.intervention.update({

            where: {

                interventionId:
                    intervention.interventionId
            },

            data: {

                status:
                    "converted",

                convertedValue:
                    value
            }
        });


    /*
    |--------------------------------------------------------------------------
    | Mark session as recovered
    |--------------------------------------------------------------------------
    */

    const updatedSession =
        await prisma.session.update({

            where: {
                sessionId
            },

            data: {

                status:
                    "recovered",

                lastActivity:
                    new Date()
            }
        });


    /*
    |--------------------------------------------------------------------------
    | Thompson Sampling Learning
    |--------------------------------------------------------------------------
    |
    | IMPORTANT:
    |
    | updateChannelReward() expects:
    |
    |     channel
    |     conversion
    |     revenue
    |
    | Do NOT pass the entire intervention object.
    |
    |--------------------------------------------------------------------------
    */

    let learning = null;


    try {

        const {
            updateChannelReward
        } = require(
            "../engines/thompsonSampling"
        );


        /*
        |--------------------------------------------------------------------------
        | Control groups have channel = "none".
        |
        | "none" is intentionally not sent to Thompson Sampling
        | because Thompson Sampling only learns from actual
        | recovery channels.
        |--------------------------------------------------------------------------
        */

        if (
            intervention.channel &&
            intervention.channel !== "none"
        ) {

            learning =
                await updateChannelReward(

                    intervention.channel,

                    true,

                    value
                );

        } else {

            learning = {

                skipped:
                    true,

                reason:
                    "Control group conversion; no recovery channel to learn from"
            };
        }


    } catch (error) {

        /*
        |--------------------------------------------------------------------------
        | Learning failure should not undo a successful conversion.
        |--------------------------------------------------------------------------
        */

        console.error(
            "Learning update failed:",
            error.message
        );


        learning = {

            skipped:
                true,

            error:
                error.message
        };
    }


    /*
    |--------------------------------------------------------------------------
    | Return conversion result
    |--------------------------------------------------------------------------
    */

    return {

        sessionId,

        interventionId:
            updatedIntervention.interventionId,

        customerId:
            updatedIntervention.customerId,

        conversionValue:
            updatedIntervention.convertedValue,

        recoveredRevenue:
            value,

        controlGroup:
            updatedIntervention.isControlGroup,

        channel:
            updatedIntervention.channel,

        sessionStatus:
            updatedSession.status,

        learning
    };
}


/*
|--------------------------------------------------------------------------
| AUDIT LOG
|--------------------------------------------------------------------------
*/

async function addAudit(
    eventType,
    payload,
    compliance = true
) {

    return await prisma.auditLog.create({

        data: {

            logId:
                "log_" +
                Date.now() +
                "_" +
                Math.random()
                    .toString(36)
                    .substring(2, 8),

            eventType,

            payload,

            complianceChecked:
                compliance
        }
    });
}


async function getAuditLogs() {

    return await prisma.auditLog.findMany({

        orderBy: {

            timestamp:
                "desc"
        },

        take:
            500
    });
}


/*
|--------------------------------------------------------------------------
| ANALYTICS METRICS
|--------------------------------------------------------------------------
*/

async function getMetrics() {

    /*
    |--------------------------------------------------------------------------
    | Sessions
    |--------------------------------------------------------------------------
    */

    const totalSessions =
        await prisma.session.count();


    /*
    |--------------------------------------------------------------------------
    | Abandoned sessions
    |--------------------------------------------------------------------------
    */

    const abandonedSessions =
        await prisma.session.count({

            where: {

                status: {

                    in: [
                        "abandoned",
                        "recovered"
                    ]
                }
            }
        });


    /*
    |--------------------------------------------------------------------------
    | Recovered sessions
    |--------------------------------------------------------------------------
    */

    const recoveredSessions =
        await prisma.session.count({

            where: {

                status:
                    "recovered"
            }
        });


    /*
    |--------------------------------------------------------------------------
    | All interventions
    |--------------------------------------------------------------------------
    */

    const interventions =
        await prisma.intervention.findMany();


    /*
    |--------------------------------------------------------------------------
    | Treatment / Control
    |--------------------------------------------------------------------------
    */

    const treatment =
        interventions.filter(
            (item) =>
                !item.isControlGroup
        );


    const control =
        interventions.filter(
            (item) =>
                item.isControlGroup
        );


    /*
    |--------------------------------------------------------------------------
    | Conversions
    |--------------------------------------------------------------------------
    */

    const treatmentConversions =
        treatment.filter(
            (item) =>
                item.status ===
                "converted"
        );


    const controlConversions =
        control.filter(
            (item) =>
                item.status ===
                "converted"
        );


    /*
    |--------------------------------------------------------------------------
    | Conversion rates
    |--------------------------------------------------------------------------
    */

    const treatmentRate =
        treatment.length > 0
            ? (
                treatmentConversions.length /
                treatment.length
            ) * 100
            : 0;


    const controlRate =
        control.length > 0
            ? (
                controlConversions.length /
                control.length
            ) * 100
            : 0;


    /*
    |--------------------------------------------------------------------------
    | Revenue
    |--------------------------------------------------------------------------
    */

    const treatmentRevenue =
        treatment.reduce(

            (sum, item) =>
                sum +
                Number(
                    item.convertedValue ||
                    0
                ),

            0
        );


    const controlRevenue =
        control.reduce(

            (sum, item) =>
                sum +
                Number(
                    item.convertedValue ||
                    0
                ),

            0
        );


    const totalRevenue =
        treatmentRevenue +
        controlRevenue;


    /*
    |--------------------------------------------------------------------------
    | Incremental lift
    |--------------------------------------------------------------------------
    */

    const incrementalRate =
        Math.max(
            0,
            treatmentRate -
            controlRate
        );


    /*
    |--------------------------------------------------------------------------
    | Incremental revenue
    |--------------------------------------------------------------------------
    */

    const incrementalRevenue =
        treatmentRevenue *
        (
            incrementalRate /
            100
        );


    /*
    |--------------------------------------------------------------------------
    | Average discount
    |--------------------------------------------------------------------------
    */

    const averageDiscount =
        treatment.length > 0

            ? treatment.reduce(

                (sum, item) =>
                    sum +
                    Number(
                        item.discountDepth ||
                        0
                    ),

                0

            ) / treatment.length

            : 0;


    /*
    |--------------------------------------------------------------------------
    | Program cost
    |--------------------------------------------------------------------------
    |
    | Simple estimated intervention cost.
    |--------------------------------------------------------------------------
    */

    const programCost =
        treatment.length *
        1.5;


    /*
    |--------------------------------------------------------------------------
    | ROI
    |--------------------------------------------------------------------------
    */

    const roi =
        programCost > 0

            ? (
                (
                    treatmentRevenue -
                    programCost
                ) /
                programCost
            ) * 100

            : 0;


    /*
    |--------------------------------------------------------------------------
    | Final metrics
    |--------------------------------------------------------------------------
    */

    return {

        totalSessions,

        abandonedCarts:
            abandonedSessions,

        recoveredCarts:
            recoveredSessions,

        recoveryRate:

            abandonedSessions > 0

                ? (
                    recoveredSessions /
                    abandonedSessions
                ) * 100

                : 0,

        treatmentRate,

        controlRate,

        treatmentRevenue,

        controlRevenue,

        totalRevenue,

        incrementalRate,

        incrementalRevenue,

        averageDiscount,

        programCost,

        roi,

        interventions:
            interventions.length,

        treatmentInterventions:
            treatment.length,

        controlInterventions:
            control.length,

        treatmentConversions:
            treatmentConversions.length,

        controlConversions:
            controlConversions.length
    };
}


/*
|--------------------------------------------------------------------------
| CHANNEL STATISTICS
|--------------------------------------------------------------------------
*/

async function getChannelStats() {

    const {
        getChannelStats:
            getThompsonChannelStats
    } = require(
        "../engines/thompsonSampling"
    );


    return await getThompsonChannelStats();
}


/*
|--------------------------------------------------------------------------
| EXPERIMENT ANALYTICS
|--------------------------------------------------------------------------
*/

async function getExperimentStats() {

    const interventions =
        await prisma.intervention.findMany();


    const treatment =
        interventions.filter(
            (item) =>
                !item.isControlGroup
        );


    const control =
        interventions.filter(
            (item) =>
                item.isControlGroup
        );


    const treatmentConversions =
        treatment.filter(
            (item) =>
                item.status ===
                "converted"
        );


    const controlConversions =
        control.filter(
            (item) =>
                item.status ===
                "converted"
        );


    const treatmentRate =
        treatment.length > 0

            ? (
                treatmentConversions.length /
                treatment.length
            ) * 100

            : 0;


    const controlRate =
        control.length > 0

            ? (
                controlConversions.length /
                control.length
            ) * 100

            : 0;


    const treatmentRevenue =
        treatment.reduce(

            (sum, item) =>
                sum +
                Number(
                    item.convertedValue ||
                    0
                ),

            0
        );


    const controlRevenue =
        control.reduce(

            (sum, item) =>
                sum +
                Number(
                    item.convertedValue ||
                    0
                ),

            0
        );


    const absoluteLift =
        treatmentRate -
        controlRate;


    const relativeLift =
        controlRate > 0

            ? (
                absoluteLift /
                controlRate
            ) * 100

            : null;


    /*
    |--------------------------------------------------------------------------
    | Incremental revenue
    |--------------------------------------------------------------------------
    */

    const incrementalRevenue =
        treatmentRevenue *
        (
            Math.max(
                0,
                absoluteLift
            ) /
            100
        );


    /*
    |--------------------------------------------------------------------------
    | Program cost
    |--------------------------------------------------------------------------
    */

    const programCost =
        treatment.length *
        1.5;


    /*
    |--------------------------------------------------------------------------
    | ROI
    |--------------------------------------------------------------------------
    */

    const roi =
        programCost > 0

            ? (
                (
                    treatmentRevenue -
                    programCost
                ) /
                programCost
            ) * 100

            : 0;


    return {

        treatment: {

            users:
                treatment.length,

            conversions:
                treatmentConversions.length,

            conversionRate:
                Number(
                    treatmentRate.toFixed(2)
                ),

            revenue:
                treatmentRevenue
        },


        control: {

            users:
                control.length,

            conversions:
                controlConversions.length,

            conversionRate:
                Number(
                    controlRate.toFixed(2)
                ),

            revenue:
                controlRevenue
        },


        lift: {

            absolutePercentagePoints:
                Number(
                    absoluteLift.toFixed(2)
                ),

            relativePercentage:
                relativeLift === null
                    ? null
                    : Number(
                        relativeLift.toFixed(2)
                    )
        },


        incrementalRevenue,

        roi
    };
}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

    /*
    | Session
    */

    createSession,
    getSession,
    updateSession,


    /*
    | Cart
    */

    createCart,
    getCart,
    updateCart,


    /*
    | Abandonment
    */

    createContext,
    getLatestContext,


    /*
    | Intervention
    */

    createIntervention,
    getIntervention,
    updateIntervention,
    getCustomerInterventions,


    /*
    | Conversion
    */

    recordConversion,


    /*
    | Audit
    */

    addAudit,
    getAuditLogs,


    /*
    | Analytics
    */

    getMetrics,
    getChannelStats,
    getExperimentStats
};