const express = require("express");

const router = express.Router();


// ============================================================
// SERVICES
// ============================================================

const {
    getMetrics,
    getAuditLogs
} = require("../services/analyticsService");


// ============================================================
// THOMPSON SAMPLING
// ============================================================

const {
    getChannelStats
} = require("../engines/thompsonSampling");


// ============================================================
// GET /api/analytics/metrics
// ============================================================

router.get("/metrics", async (req, res) => {

    try {

        const metrics =
            await getMetrics();


        return res.json({

            success: true,

            metrics

        });

    } catch (error) {

        console.error(
            "Metrics error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to get metrics",

            error:
                error.message

        });

    }

});


// ============================================================
// GET /api/analytics/audit
// ============================================================

router.get("/audit", async (req, res) => {

    try {

        const logs =
            await getAuditLogs();


        return res.json({

            success: true,

            count:
                logs.length,

            logs

        });

    } catch (error) {

        console.error(
            "Audit error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to get audit logs",

            error:
                error.message

        });

    }

});


// ============================================================
// GET /api/analytics/channel-stats
// ============================================================
//
// Returns persistent Thompson Sampling statistics.
//
// ============================================================

router.get(
    "/channel-stats",
    async (req, res) => {

        try {

            const channelStats =
                await getChannelStats();


            return res.json({

                success: true,

                count:
                    channelStats.length,

                channels:
                    channelStats

            });

        } catch (error) {

            console.error(
                "Channel statistics error:",
                error
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to get channel statistics",

                error:
                    error.message

            });

        }

    }
);


// ============================================================
// EXPORT
// ============================================================
// ============================================================
// GET /api/analytics/experiment
// ============================================================

router.get("/experiment", async (req, res) => {

    try {

        const metrics = await getMetrics();

        const treatmentUsers =
            metrics.treatmentInterventions || 0;

        const controlUsers =
            metrics.controlInterventions || 0;

        const treatmentConversions =
            metrics.treatmentConversions || 0;

        const controlConversions =
            metrics.controlConversions || 0;

        const treatmentRate =
            treatmentUsers > 0
                ? (treatmentConversions / treatmentUsers) * 100
                : 0;

        const controlRate =
            controlUsers > 0
                ? (controlConversions / controlUsers) * 100
                : 0;

        const absoluteLift =
            treatmentRate - controlRate;

        const relativeLift =
            controlRate > 0
                ? (
                    (treatmentRate - controlRate) /
                    controlRate
                ) * 100
                : null;


        return res.json({

            success: true,

            experiment: {

                treatment: {

                    users:
                        treatmentUsers,

                    conversions:
                        treatmentConversions,

                    conversionRate:
                        Number(
                            treatmentRate.toFixed(2)
                        ),

                    revenue:
                        metrics.treatmentRevenue || 0

                },

                control: {

                    users:
                        controlUsers,

                    conversions:
                        controlConversions,

                    conversionRate:
                        Number(
                            controlRate.toFixed(2)
                        ),

                    revenue:
                        metrics.controlRevenue || 0

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

                incrementalRevenue:
                    metrics.incrementalRevenue || 0,

                roi:
                    metrics.roi || 0

            }

        });

    } catch (error) {

        console.error(
            "Experiment analytics error:",
            error
        );

        return res.status(500).json({

            success: false,

            message:
                "Failed to get experiment analytics",

            error:
                error.message

        });

    }

});
module.exports = router;
