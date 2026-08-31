const express = require("express");

const router = express.Router();


// ============================================================
// SERVICES
// ============================================================

const {
    getSession,
    getCart,
    getLatestContext,
    createIntervention,
    addAudit
} = require("../services/analyticsService");


// ============================================================
// ENGINES / SERVICES
// ============================================================

const {
    decideRecovery
} = require("../engines/decisionEngine");

const {
    checkCompliance
} = require("../services/complianceService");

const {
    dispatch
} = require("../services/dispatcherService");


// ============================================================
// CONSTANTS
// ============================================================

const VALID_CHANNELS = [
    "email",
    "sms",
    "push",
    "in_app"
];


// ============================================================
// ID GENERATOR
// ============================================================

function generateInterventionId() {

    return (
        "int_" +
        Date.now() +
        "_" +
        Math.random()
            .toString(36)
            .substring(2, 8)
    );

}


// ============================================================
// POST /api/recovery/execute
// ============================================================

router.post("/execute", async (req, res) => {

    try {

        const {
            sessionId,
            consent = true
        } = req.body;


        // ====================================================
        // 1. VALIDATE REQUEST
        // ====================================================

        if (!sessionId) {

            return res.status(400).json({

                success: false,

                message:
                    "sessionId is required"

            });

        }


        // ====================================================
        // 2. GET SESSION
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
        // 3. GET CART
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
        // 4. GET ABANDONMENT CONTEXT
        // ====================================================

        const context =
            await getLatestContext(
                sessionId
            );


        if (!context) {

            return res.status(400).json({

                success: false,

                message:
                    "Abandonment context not found. Evaluate abandonment first."

            });

        }


        // ====================================================
        // 5. PARSE ROOT CAUSE
        // ====================================================

        let rootCause = {};


        try {

            rootCause =
                JSON.parse(
                    context.rootCauseNotes ||
                    "{}"
                );

        } catch (error) {

            console.warn(
                "Invalid root cause JSON. Using inactivity fallback."
            );

            rootCause = {

                category:
                    "INACTIVITY"

            };

        }


        // ====================================================
        // 6. DECISION ENGINE
        // ====================================================
        //
        // IMPORTANT:
        //
        // decideRecovery() is async because Thompson Sampling
        // now reads/writes PostgreSQL.
        //
        // Therefore await is REQUIRED.
        //
        // ====================================================

        const decision =
            await decideRecovery({

                session,

                cart,

                rootCause

            });


        console.log(
            "Recovery decision:",
            decision
        );


        // ====================================================
        // 7. CONTROL GROUP
        // ====================================================

        if (
            decision.isControlGroup === true
        ) {

            const intervention =
                await createIntervention({

                    interventionId:
                        generateInterventionId(),

                    sessionId,

                    customerId:
                        session.customerId,

                    channel:
                        "none",

                    offerType:
                        "none",

                    discountDepth:
                        0,

                    status:
                        "control",

                    isControlGroup:
                        true,

                    convertedValue:
                        0

                });


            await addAudit(

                "CONTROL_GROUP_ASSIGNED",

                {

                    sessionId,

                    customerId:
                        session.customerId,

                    cartValue:
                        cart.totalValue,

                    interventionId:
                        intervention.interventionId,

                    decision

                },

                true

            );


            return res.json({

                success: true,

                treatment: false,

                controlGroup: true,

                message:
                    "Customer assigned to control group",

                decision,

                intervention

            });

        }


        // ====================================================
        // 8. VALIDATE CHANNEL
        // ====================================================

        if (
            !VALID_CHANNELS.includes(
                decision.channel
            )
        ) {

            console.error(
                "Invalid channel returned by decision engine:",
                decision.channel
            );


            return res.status(500).json({

                success: false,

                message:
                    "Decision engine selected an invalid channel",

                channel:
                    decision.channel,

                validChannels:
                    VALID_CHANNELS

            });

        }


        // ====================================================
        // 9. COMPLIANCE CHECK
        // ====================================================

        const compliance =
            await checkCompliance({

                customerId:
                    session.customerId,

                channel:
                    decision.channel,

                consent

            });


        // ====================================================
        // 10. BLOCK IF COMPLIANCE FAILS
        // ====================================================

        if (
            !compliance.allowed
        ) {

            await addAudit(

                "INTERVENTION_BLOCKED",

                {

                    sessionId,

                    customerId:
                        session.customerId,

                    channel:
                        decision.channel,

                    offerType:
                        decision.offerType,

                    reasons:
                        compliance.reasons,

                    decision

                },

                false

            );


            return res.status(403).json({

                success: false,

                blocked: true,

                message:
                    "Intervention blocked by compliance",

                reasons:
                    compliance.reasons,

                channel:
                    decision.channel

            });

        }


        // ====================================================
        // 11. DISPATCH
        // ====================================================

        const delivery =
            await dispatch({

                channel:
                    decision.channel,

                customerId:
                    session.customerId,

                offerType:
                    decision.offerType,

                discountDepth:
                    decision.discountDepth

            });


        // ====================================================
        // 12. SAVE INTERVENTION
        // ====================================================

        const intervention =
            await createIntervention({

                interventionId:
                    generateInterventionId(),

                sessionId,

                customerId:
                    session.customerId,

                channel:
                    decision.channel,

                offerType:
                    decision.offerType,

                discountDepth:
                    decision.discountDepth,

                status:
                    delivery.success
                        ? "sent"
                        : "blocked",

                isControlGroup:
                    false,

                convertedValue:
                    0

            });


        // ====================================================
        // 13. AUDIT
        // ====================================================

        await addAudit(

            "RECOVERY_INTERVENTION_SENT",

            {

                sessionId,

                customerId:
                    session.customerId,

                cartValue:
                    cart.totalValue,

                channel:
                    decision.channel,

                offerType:
                    decision.offerType,

                discountDepth:
                    decision.discountDepth,

                interventionId:
                    intervention.interventionId,

                compliance:
                    compliance.allowed,

                delivery,

                decision

            },

            true

        );


        // ====================================================
        // 14. RESPONSE
        // ====================================================

        return res.json({

            success: true,

            treatment: true,

            controlGroup: false,

            message:
                "Recovery intervention executed successfully",

            sessionId,

            customerId:
                session.customerId,

            cartValue:
                cart.totalValue,

            decision,

            compliance,

            delivery,

            intervention

        });


    } catch (error) {

        console.error(
            "Recovery execution error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Recovery execution failed",

            error:
                error.message

        });

    }

});


// ============================================================
// EXPORT
// ============================================================

module.exports = router;