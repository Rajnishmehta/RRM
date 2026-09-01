const express = require("express");

const router = express.Router();


// ============================================================
// SERVICES
// ============================================================

const {
    getMetrics,
    getAuditLogs,
    getExperimentAnalytics
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
// GET /api/analytics/experiment
// ============================================================
//
// IMPORTANT:
//
// Experiment calculations are handled by
// getExperimentAnalytics() inside analyticsService.
//
// Do NOT calculate experiment values from getMetrics() here.
//
// ============================================================

router.get(
    "/experiment",
    async (req, res) => {

        try {

            const experiment =
                await getExperimentAnalytics();


            return res.json({

                success: true,

                experiment

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

    }
);


// ============================================================
// EXPORT
// ============================================================

module.exports = router;
