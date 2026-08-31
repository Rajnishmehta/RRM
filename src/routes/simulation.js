const express = require("express");

const router = express.Router();


// ============================================================
// SERVICES
// ============================================================

const {
    getSession,
    getCart,
    getIntervention,
    getLatestIntervention,
    recordConversion,
    updateSession,
    addAudit
} = require("../services/analyticsService");


// ============================================================
// THOMPSON SAMPLING
// ============================================================

const {
    updateChannelReward
} = require("../engines/thompsonSampling");


// ============================================================
// POST /api/simulation/convert
// ============================================================
//
// Development/testing endpoint.
//
// Simulates a customer completing checkout after receiving
// a recovery intervention.
//
// Flow:
//
// Session
//   ↓
// Intervention
//   ↓
// Conversion
//   ↓
// Revenue
//   ↓
// Session recovered
//   ↓
// Thompson Sampling learns
//   ↓
// Audit log
//
// ============================================================

router.post("/convert", async (req, res) => {

    try {

        const {
            sessionId,
            interventionId,
            conversionValue
        } = req.body;


        // ====================================================
        // VALIDATION
        // ====================================================

        if (!sessionId) {

            return res.status(400).json({

                success: false,

                message:
                    "sessionId is required"

            });

        }


        const value =
            Number(conversionValue);


        if (
            !Number.isFinite(value) ||
            value <= 0
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "conversionValue must be a positive number"

            });

        }


        // ====================================================
        // GET SESSION
        // ====================================================

        const session =
            await getSession(
                sessionId
            );


        if (!session) {

            return res.status(404).json({

                success: false,

                message:
                    "Session not found"

            });

        }


        // ====================================================
        // GET CART
        // ====================================================

        const cart =
            await getCart(
                sessionId
            );


        if (!cart) {

            return res.status(404).json({

                success: false,

                message:
                    "Cart not found"

            });

        }


        // ====================================================
        // GET INTERVENTION
        // ====================================================

        let intervention;


        if (interventionId) {

            intervention =
                await getIntervention(
                    interventionId
                );

        }

        else {

            intervention =
                await getLatestIntervention(
                    sessionId
                );

        }


        if (!intervention) {

            return res.status(400).json({

                success: false,

                message:
                    "No recovery intervention found for this session"

            });

        }


        // ====================================================
        // VERIFY INTERVENTION BELONGS TO SESSION
        // ====================================================

        if (
            intervention.sessionId !==
            sessionId
        ) {

            return res.status(400).json({

                success: false,

                message:
                    "Intervention does not belong to this session"

            });

        }


        // ====================================================
        // CONTROL GROUP
        // ====================================================
        //
        // Control users should normally not have a treatment
        // intervention. However, if a control intervention is
        // somehow supplied, we still record the conversion but
        // do NOT give Thompson Sampling a treatment reward.
        //
        // This keeps the experiment statistically cleaner.
        // ====================================================

        const isControlGroup =
            Boolean(
                intervention.isControlGroup
            );


        // ====================================================
        // PREVENT DUPLICATE CONVERSION
        // ====================================================

        if (
            intervention.status ===
            "converted"
        ) {

            return res.status(409).json({

                success: false,

                message:
                    "This intervention has already been converted",

                interventionId:
                    intervention.interventionId,

                previousConversionValue:
                    intervention.convertedValue

            });

        }


        // ====================================================
        // RECORD CONVERSION
        // ====================================================
        //
        // Updates:
        //
        // Intervention.status
        // Intervention.convertedValue
        //
        // ====================================================

        const updatedIntervention =
            await recordConversion({

                interventionId:
                    intervention.interventionId,

                convertedValue:
                    value

            });


        // ====================================================
        // UPDATE SESSION
        // ====================================================
        //
        // Customer successfully completed checkout.
        //
        // abandoned → recovered
        //
        // ====================================================

        const updatedSession =
            await updateSession(

                sessionId,

                {

                    status:
                        "recovered",

                    lastActivity:
                        new Date()

                }

            );


        // ====================================================
        // THOMPSON SAMPLING LEARNING
        // ====================================================
        //
        // IMPORTANT:
        //
        // Revenue is passed as the third argument.
        //
        // This fixes the previous issue where:
        //
        // conversion = 1
        // revenue = 0
        //
        // ====================================================

        let learning = null;


        if (
            !isControlGroup &&
            intervention.channel !== "none"
        ) {

            learning =
                updateChannelReward(

                    intervention.channel,

                    true,

                    value

                );

        }


        // ====================================================
        // AUDIT LOG
        // ====================================================

        await addAudit(

            "CHECKOUT_CONVERTED",

            {

                sessionId,

                customerId:
                    session.customerId,

                interventionId:
                    intervention.interventionId,

                channel:
                    intervention.channel,

                offerType:
                    intervention.offerType,

                discountDepth:
                    intervention.discountDepth,

                conversionValue:
                    value,

                recoveredRevenue:
                    value,

                controlGroup:
                    isControlGroup,

                learning

            },

            true

        );


        // ====================================================
        // RESPONSE
        // ====================================================

        return res.status(200).json({

            success: true,

            message:
                "Conversion recorded successfully",

            sessionId,

            interventionId:
                updatedIntervention
                    .interventionId,

            customerId:
                session.customerId,

            conversionValue:
                value,

            recoveredRevenue:
                value,

            controlGroup:
                isControlGroup,

            channel:
                intervention.channel,

            sessionStatus:
                updatedSession.status,

            intervention: {

                status:
                    updatedIntervention.status,

                convertedValue:
                    updatedIntervention
                        .convertedValue

            },

            learning

        });


    } catch (error) {

        console.error(

            "Conversion simulation error:",

            error

        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to record conversion",

            error:
                error.message

        });

    }

});


// ============================================================
// GET /api/simulation/status/:sessionId
// ============================================================
//
// Useful development endpoint to inspect the complete state
// of a test session.
// ============================================================

router.get(
    "/status/:sessionId",
    async (req, res) => {

        try {

            const {
                sessionId
            } = req.params;


            const session =
                await getSession(
                    sessionId
                );


            if (!session) {

                return res.status(404).json({

                    success: false,

                    message:
                        "Session not found"

                });

            }


            const cart =
                await getCart(
                    sessionId
                );


            const intervention =
                await getLatestIntervention(
                    sessionId
                );


            return res.json({

                success: true,

                session,

                cart,

                intervention

            });


        } catch (error) {

            console.error(

                "Simulation status error:",

                error

            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to get simulation status",

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