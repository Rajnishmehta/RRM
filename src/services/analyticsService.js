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
                data.device || "Unknown",

            geo:
                data.geo || "Unknown",

            trafficSource:
                data.trafficSource || "Direct",

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
                data.lastAction || null,

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
            timeAtCheckout: "desc"
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
                data.sentAt
                    ? new Date(data.sentAt)
                    : new Date(),

            status:
                data.status || "sent",

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


/*
|--------------------------------------------------------------------------
| GET LATEST INTERVENTION
|--------------------------------------------------------------------------
*/

async function getLatestIntervention(
    sessionId
) {

    return await prisma.intervention.findFirst({

        where: {
            sessionId: sessionId
        },

        orderBy: {
            sentAt: "desc"
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
            sentAt: "desc"
        }
    });
}


/*
|--------------------------------------------------------------------------
| RECORD CONVERSION
|--------------------------------------------------------------------------
|
| Supports:
|
| recordConversion(sessionId, conversionValue)
|
| OR:
|
| recordConversion(interventionObject, conversionValue)
|
|--------------------------------------------------------------------------
*/

async function recordConversion(
    interventionOrSession,
    conversionValue
) {

    let intervention = null;


    /*
    |--------------------------------------------------------------------------
    | CASE 1: Intervention object
    |--------------------------------------------------------------------------
    */

    if (
        typeof interventionOrSession === "object" &&
        interventionOrSession !== null
    ) {

        if (
            interventionOrSession.interventionId
        ) {

            intervention =
                await prisma.intervention.findUnique({

                    where: {
                        interventionId:
                            interventionOrSession.interventionId
                    }
                });
        }
    }


    /*
    |--------------------------------------------------------------------------
    | CASE 2: Session ID
    |--------------------------------------------------------------------------
    */

    else if (
        typeof interventionOrSession === "string"
    ) {

        intervention =
            await getLatestIntervention(
                interventionOrSession
            );
    }


    /*
    |--------------------------------------------------------------------------
    | Validate intervention
    |--------------------------------------------------------------------------
    */

    if (!intervention) {

        throw new Error(
            "No intervention found for conversion"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Conversion value
    |--------------------------------------------------------------------------
    */

    let value;


    if (
        conversionValue !== undefined &&
        conversionValue !== null
    ) {

        value =
            Number(conversionValue);

    } else if (
        intervention.convertedValue !== undefined &&
        intervention.convertedValue !== null
    ) {

        value =
            Number(
                intervention.convertedValue
            );

    } else {

        value = 0;
    }


    /*
    |--------------------------------------------------------------------------
    | Validate conversion value
    |--------------------------------------------------------------------------
    */

    if (
        !Number.isFinite(value) ||
        value < 0
    ) {

        throw new Error(
            "Invalid conversion value"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Prevent duplicate conversion
    |--------------------------------------------------------------------------
    */

    if (
        intervention.status ===
        "converted"
    ) {

        throw new Error(
            "Intervention has already been converted"
        );
    }


    /*
    |--------------------------------------------------------------------------
    | Update intervention
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
    | Update session
    |--------------------------------------------------------------------------
    */

    const session =
        await prisma.session.update({

            where: {

                sessionId:
                    intervention.sessionId
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
    | Return result
    |--------------------------------------------------------------------------
    */

    return {

        intervention:
            updatedIntervention,

        session,

        recoveredRevenue:
            value
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
            timestamp: "desc"
        },

        take: 500
    });
}


/*
|--------------------------------------------------------------------------
| GENERAL ANALYTICS
|--------------------------------------------------------------------------
*/

async function getMetrics() {

    const totalSessions =
        await prisma.session.count();


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


    const recoveredSessions =
        await prisma.session.count({

            where: {

                status:
                    "recovered"
            }
        });


    const treatment =
        await prisma.intervention.findMany({

            where: {

                isControlGroup:
                    false
            }
        });


    const control =
        await prisma.intervention.findMany({

            where: {

                isControlGroup:
                    true
            }
        });


    const treatmentConversions =
        treatment.filter(
            item =>
                item.status ===
                "converted"
        );


    const controlConversions =
        control.filter(
            item =>
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


    const totalRevenue =
        treatment.reduce(

            (
                total,
                item
            ) =>
                total +
                Number(
                    item.convertedValue ||
                    0
                ),

            0
        );


    const incrementalRate =
        Math.max(
            0,
            treatmentRate -
            controlRate
        );


    const incrementalRevenue =
        totalRevenue *
        (
            incrementalRate /
            100
        );


    const averageDiscount =
        treatment.length > 0
            ? (
                treatment.reduce(

                    (
                        total,
                        item
                    ) =>
                        total +
                        Number(
                            item.discountDepth ||
                            0
                        ),

                    0
                ) /
                treatment.length
            )
            : 0;


    const programCost =
        treatment.length *
        1.5;


    const roi =
        programCost > 0
            ? (
                (
                    incrementalRevenue -
                    programCost
                ) /
                programCost
            ) * 100
            : 0;


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

        incrementalRevenue,

        averageDiscount,

        roi,

        interventions:
            treatment.length +
            control.length
    };
}


/*
|--------------------------------------------------------------------------
| CHANNEL STATISTICS
|--------------------------------------------------------------------------
*/

async function getChannelStats() {

    const stats =
        await prisma.channelStats.findMany({

            orderBy: {
                channel: "asc"
            }
        });


    return stats.map(
        item => ({

            channel:
                item.channel,

            alpha:
                item.alpha,

            beta:
                item.beta,

            attempts:
                item.attempts,

            conversions:
                item.conversions,

            revenue:
                item.revenue,

            estimatedConversionRate:

                Number(
                    (
                        item.alpha /
                        (
                            item.alpha +
                            item.beta
                        )
                    ).toFixed(4)
                )
        })
    );
}


/*
|--------------------------------------------------------------------------
| EXPERIMENT ANALYTICS
|--------------------------------------------------------------------------
|
| Treatment vs Control experiment.
|
| Incremental revenue is calculated using:
|
| Expected control revenue =
| treatment users × control revenue per user
|
| Incremental revenue =
| treatment revenue - expected control revenue
|
|--------------------------------------------------------------------------
*/

async function getExperimentAnalytics() {

    /*
    |--------------------------------------------------------------------------
    | Load treatment and control groups
    |--------------------------------------------------------------------------
    */

    const treatment =
        await prisma.intervention.findMany({

            where: {
                isControlGroup: false
            }
        });


    const control =
        await prisma.intervention.findMany({

            where: {
                isControlGroup: true
            }
        });


    /*
    |--------------------------------------------------------------------------
    | Count conversions
    |--------------------------------------------------------------------------
    */

    const treatmentConversions =
        treatment.filter(
            item =>
                item.status ===
                "converted"
        );


    const controlConversions =
        control.filter(
            item =>
                item.status ===
                "converted"
        );


    /*
    |--------------------------------------------------------------------------
    | Revenue
    |--------------------------------------------------------------------------
    */

    const treatmentRevenue =
        treatment.reduce(

            (
                total,
                item
            ) =>
                total +
                Number(
                    item.convertedValue ||
                    0
                ),

            0
        );


    const controlRevenue =
        control.reduce(

            (
                total,
                item
            ) =>
                total +
                Number(
                    item.convertedValue ||
                    0
                ),

            0
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
    | Absolute lift
    |--------------------------------------------------------------------------
    */

    const absoluteLift =
        treatmentRate -
        controlRate;


    /*
    |--------------------------------------------------------------------------
    | Relative lift
    |--------------------------------------------------------------------------
    */

    let relativeLift =
        null;


    if (
        controlRate > 0
    ) {

        relativeLift =
            (
                absoluteLift /
                controlRate
            ) * 100;
    }


    /*
    |--------------------------------------------------------------------------
    | Revenue per user
    |--------------------------------------------------------------------------
    */

    const treatmentRevenuePerUser =
        treatment.length > 0
            ? treatmentRevenue /
              treatment.length
            : 0;


    const controlRevenuePerUser =
        control.length > 0
            ? controlRevenue /
              control.length
            : 0;


    /*
    |--------------------------------------------------------------------------
    | Expected control revenue
    |--------------------------------------------------------------------------
    |
    | If the treatment group had performed like the control group,
    | this is the approximate revenue we would expect.
    |
    */

    const expectedControlRevenue =
        treatment.length *
        controlRevenuePerUser;


    /*
    |--------------------------------------------------------------------------
    | Incremental revenue
    |--------------------------------------------------------------------------
    */

    const incrementalRevenue =
        treatmentRevenue -
        expectedControlRevenue;


    /*
    |--------------------------------------------------------------------------
    | Experiment cost
    |--------------------------------------------------------------------------
    |
    | Demo assumption:
    | ₹1.50 per treatment intervention.
    |
    */

    const costPerTreatment =
        1.5;


    const programCost =
        treatment.length *
        costPerTreatment;


    /*
    |--------------------------------------------------------------------------
    | ROI
    |--------------------------------------------------------------------------
    |
    | ROI =
    |
    | (Incremental Revenue - Cost)
    | --------------------------- × 100
    |          Cost
    |
    |--------------------------------------------------------------------------
    */

    const roi =
        programCost > 0
            ? (
                (
                    incrementalRevenue -
                    programCost
                ) /
                programCost
            ) * 100
            : 0;


    /*
    |--------------------------------------------------------------------------
    | Clean result
    |--------------------------------------------------------------------------
    */

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
                Number(
                    treatmentRevenue.toFixed(2)
                ),

            revenuePerUser:
                Number(
                    treatmentRevenuePerUser.toFixed(2)
                )
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
                Number(
                    controlRevenue.toFixed(2)
                ),

            revenuePerUser:
                Number(
                    controlRevenuePerUser.toFixed(2)
                )
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


        expectedControlRevenue:
            Number(
                expectedControlRevenue.toFixed(2)
            ),


        incrementalRevenue:
            Number(
                incrementalRevenue.toFixed(2)
            ),


        programCost:
            Number(
                programCost.toFixed(2)
            ),


        roi:
            Number(
                roi.toFixed(2)
            )
    };
}


/*
|--------------------------------------------------------------------------
| EXPORTS
|--------------------------------------------------------------------------
*/

module.exports = {

    /*
    |--------------------------------------------------------------------------
    | Session
    |--------------------------------------------------------------------------
    */

    createSession,
    getSession,
    updateSession,


    /*
    |--------------------------------------------------------------------------
    | Cart
    |--------------------------------------------------------------------------
    */

    createCart,
    getCart,
    updateCart,


    /*
    |--------------------------------------------------------------------------
    | Abandonment
    |--------------------------------------------------------------------------
    */

    createContext,
    getLatestContext,


    /*
    |--------------------------------------------------------------------------
    | Intervention
    |--------------------------------------------------------------------------
    */

    createIntervention,
    getIntervention,
    getLatestIntervention,
    updateIntervention,
    getCustomerInterventions,


    /*
    |--------------------------------------------------------------------------
    | Conversion
    |--------------------------------------------------------------------------
    */

    recordConversion,


    /*
    |--------------------------------------------------------------------------
    | Audit
    |--------------------------------------------------------------------------
    */

    addAudit,
    getAuditLogs,


    /*
    |--------------------------------------------------------------------------
    | Analytics
    |--------------------------------------------------------------------------
    */

    getMetrics,
    getChannelStats,
    getExperimentAnalytics
};