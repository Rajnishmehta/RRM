const express = require("express");

const router = express.Router();

const {
    getSession,
    getCart,
    createContext,
    updateSession,
    addAudit
} = require("../services/analyticsService");

const {
    analyzeRootCause
} = require("../engines/rootCauseEngine");


// ============================================================
// POST /api/abandonment/evaluate
// ============================================================

router.post("/evaluate", async (req, res) => {

    try {

        const {
            sessionId,
            lastAction,
            paymentErrorCode
        } = req.body;


        // ------------------------------------------------------
        // Validate request
        // ------------------------------------------------------

        if (!sessionId) {

            return res.status(400).json({
                success: false,
                message: "sessionId is required"
            });

        }


        // ------------------------------------------------------
        // Get session
        // ------------------------------------------------------

        const session =
            await getSession(sessionId);


        if (!session) {

            return res.status(404).json({
                success: false,
                message: "Session not found"
            });

        }


        // ------------------------------------------------------
        // Get cart
        // ------------------------------------------------------

        const cart =
            await getCart(sessionId);


        if (!cart) {

            return res.status(404).json({
                success: false,
                message: "Cart not found"
            });

        }


        // ------------------------------------------------------
        // Calculate inactivity
        // ------------------------------------------------------

        const now = new Date();

        const lastActivity =
            session.lastActivity
                ? new Date(session.lastActivity)
                : new Date(session.startTime);


        const inactiveMinutes =
            (now.getTime() -
                lastActivity.getTime()) /
            60000;


        // ------------------------------------------------------
        // Abandonment triggers
        // ------------------------------------------------------

        const paymentFailed =
            Boolean(paymentErrorCode);


        const checkoutExit =
            lastAction === "checkout_exit";


        const inactiveTooLong =
            inactiveMinutes >= 5;


        /*
         * IMPORTANT:
         *
         * checkout_exit means the customer actually
         * left checkout.
         *
         * Therefore we don't require 5 minutes for
         * checkout_exit or payment failure.
         */

        const isAbandoned =
            checkoutExit ||
            paymentFailed ||
            inactiveTooLong;


        // ------------------------------------------------------
        // Not abandoned
        // ------------------------------------------------------

        if (!isAbandoned) {

            return res.json({

                success: true,

                abandoned: false,

                reason:
                    "Abandonment threshold not reached",

                inactiveMinutes:
                    Number(
                        inactiveMinutes.toFixed(2)
                    ),

                requiredMinutes: 5
            });

        }


        // ------------------------------------------------------
        // Determine trigger
        // ------------------------------------------------------

        let trigger;

        if (paymentFailed) {

            trigger = "payment_failure";

        } else if (checkoutExit) {

            trigger = "checkout_exit";

        } else {

            trigger = "inactivity";

        }


        // ------------------------------------------------------
        // Root cause analysis
        // ------------------------------------------------------

        const rootCause =
            await analyzeRootCause({

                session: {

                    sessionId:
                        session.sessionId,

                    customerId:
                        session.customerId,

                    device:
                        session.device,

                    geo:
                        session.geo,

                    trafficSource:
                        session.trafficSource,

                    clv:
                        session.clv
                },


                cart: {

                    items:
                        cart.items,

                    totalValue:
                        cart.totalValue,

                    categories:
                        cart.categories
                },


                lastAction,

                inactiveMinutes,

                paymentErrorCode
            });


        // ------------------------------------------------------
        // Save abandonment context
        // ------------------------------------------------------

        const context =
            await createContext({

                contextId:
                    `ctx_${Date.now()}_${Math.random()
                        .toString(36)
                        .substring(2, 8)}`,

                sessionId,

                lastAction:
                    lastAction || null,

                timeAtCheckout:
                    now,

                paymentErrorCode:
                    paymentErrorCode || null,

                rootCauseNotes:
                    JSON.stringify(rootCause)
            });


        // ------------------------------------------------------
        // Update session
        // ------------------------------------------------------

        await updateSession(

            sessionId,

            {

                status: "abandoned",

                lastActivity: now

            }

        );


        // ------------------------------------------------------
        // Audit log
        // ------------------------------------------------------

        await addAudit(

            "CHECKOUT_ABANDONED",

            {

                sessionId,

                customerId:
                    session.customerId,

                cartValue:
                    cart.totalValue,

                trigger,

                inactiveMinutes,

                rootCause

            },

            true

        );


        // ------------------------------------------------------
        // Response
        // ------------------------------------------------------

        return res.json({

            success: true,

            abandoned: true,

            sessionId,

            contextId:
                context.contextId,

            trigger,

            inactiveMinutes:
                Number(
                    inactiveMinutes.toFixed(2)
                ),

            cartValue:
                cart.totalValue,

            rootCause

        });


    } catch (error) {

        console.error(
            "Abandonment evaluation error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to evaluate abandonment",

            error:
                error.message

        });

    }

});


module.exports = router;