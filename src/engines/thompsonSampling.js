const { prisma } = require("../config/prisma");


// ============================================================
// RecoverIQ - Persistent Thompson Sampling
// ============================================================
//
// Channel statistics are stored in PostgreSQL.
//
// Channels:
// email
// sms
// push
// in_app
//
// Beta distribution:
// alpha = successful outcomes + prior
// beta  = unsuccessful outcomes + prior
//
// ============================================================


const CHANNELS = [
    "email",
    "sms",
    "push",
    "in_app"
];


// ============================================================
// RANDOM NORMAL
// ============================================================

function randomNormal() {

    let u = 0;
    let v = 0;

    while (u === 0) {
        u = Math.random();
    }

    while (v === 0) {
        v = Math.random();
    }

    return Math.sqrt(
        -2 * Math.log(u)
    ) *
    Math.cos(
        2 * Math.PI * v
    );

}


// ============================================================
// GAMMA SAMPLE
// ============================================================

function sampleGamma(shape) {

    if (shape < 1) {

        const u =
            Math.random();

        return sampleGamma(
            shape + 1
        ) *
        Math.pow(
            u,
            1 / shape
        );

    }


    const d =
        shape - 1 / 3;

    const c =
        1 /
        Math.sqrt(
            9 * d
        );


    while (true) {

        const x =
            randomNormal();

        const v =
            1 + c * x;


        if (v <= 0) {
            continue;
        }


        const v3 =
            v * v * v;

        const u =
            Math.random();


        if (
            u <
            1 -
            0.0331 *
            Math.pow(x, 4)
        ) {

            return d * v3;

        }


        if (
            Math.log(u) <
            0.5 * x * x +
            d *
            (
                1 -
                v3 +
                Math.log(v3)
            )
        ) {

            return d * v3;

        }

    }

}


// ============================================================
// BETA SAMPLE
// ============================================================

function sampleBeta(
    alpha,
    beta
) {

    const x =
        sampleGamma(alpha);

    const y =
        sampleGamma(beta);


    return x / (x + y);

}


// ============================================================
// ENSURE CHANNEL ROWS EXIST
// ============================================================

async function initializeChannels() {

    for (
        const channel
        of CHANNELS
    ) {

        await prisma.channelStats.upsert({

            where: {
                channel
            },

            update: {},

            create: {

                channel,

                alpha: 1,

                beta: 1,

                attempts: 0,

                conversions: 0,

                revenue: 0

            }

        });

    }

}


// ============================================================
// CHOOSE CHANNEL
// ============================================================
//
// IMPORTANT:
// This function is now asynchronous because statistics come
// from PostgreSQL.
//
// ============================================================

async function chooseChannel() {

    await initializeChannels();


    const stats =
        await prisma.channelStats.findMany({

            where: {

                channel: {
                    in: CHANNELS
                }

            }

        });


    let bestChannel =
        null;

    let bestSample =
        -Infinity;


    for (
        const item
        of stats
    ) {

        const sample =
            sampleBeta(

                Number(item.alpha),

                Number(item.beta)

            );


        if (
            sample >
            bestSample
        ) {

            bestSample =
                sample;

            bestChannel =
                item.channel;

        }

    }


    if (!bestChannel) {

        throw new Error(
            "No recovery channel available"
        );

    }


    // Record attempt

    await prisma.channelStats.update({

        where: {

            channel:
                bestChannel

        },

        data: {

            attempts: {

                increment: 1

            }

        }

    });


    return bestChannel;

}


// ============================================================
// UPDATE CHANNEL REWARD
// ============================================================

async function updateChannelReward(
    channel,
    conversion,
    revenue = 0
) {

    if (
        !CHANNELS.includes(channel)
    ) {

        throw new Error(
            `Invalid recovery channel: ${channel}`
        );

    }


    const converted =
        Boolean(conversion);


    const value =
        Number(revenue) || 0;


    const current =
        await prisma.channelStats.findUnique({

            where: {
                channel
            }

        });


    if (!current) {

        await initializeChannels();

    }


    const updated =
        await prisma.channelStats.update({

            where: {

                channel

            },

            data: {

                alpha:
                    converted
                        ? {
                            increment: 1
                        }
                        : undefined,

                beta:
                    converted
                        ? undefined
                        : {
                            increment: 1
                        },

                conversions:
                    converted
                        ? {
                            increment: 1
                        }
                        : undefined,

                revenue:
                    converted
                        ? {
                            increment: value
                        }
                        : undefined

            }

        });


    return {

        channel,

        conversion:
            converted,

        reward:
            converted ? 1 : 0,

        alpha:
            updated.alpha,

        beta:
            updated.beta,

        attempts:
            updated.attempts,

        conversions:
            updated.conversions,

        revenue:
            updated.revenue,

        estimatedConversionRate:
            Number(

                (

                    updated.alpha /

                    (
                        updated.alpha +
                        updated.beta
                    )

                ).toFixed(4)

            )

    };

}


// ============================================================
// GET CHANNEL STATS
// ============================================================

async function getChannelStats() {

    await initializeChannels();


    const stats =
        await prisma.channelStats.findMany({

            orderBy: {

                channel:
                    "asc"

            }

        });


    return stats.map(item => ({

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

    }));

}


// ============================================================
// RESET CHANNEL STATS
// ============================================================
//
// Development/testing only.
// ============================================================

async function resetChannelStats() {

    await initializeChannels();


    await prisma.channelStats.updateMany({

        data: {

            alpha: 1,

            beta: 1,

            attempts: 0,

            conversions: 0,

            revenue: 0

        }

    });


    return await getChannelStats();

}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {

    chooseChannel,

    updateChannelReward,

    getChannelStats,

    resetChannelStats

};