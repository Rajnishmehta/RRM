const express = require("express");
const router = express.Router();

const { prisma } = require("../config/prisma");

const {
    createSession,
    getSession,
    updateSession,
    createCart,
    getCart,
    addAudit
} = require("../services/analyticsService");


// ============================================================================
// POST /api/sessions/track
// ============================================================================
//
// Creates or updates a customer session.
//
// For a NEW session:
//      Session + Cart are created inside one Prisma transaction.
//
// This prevents situations where:
//      Session succeeds
//      Cart fails
//      => orphan session remains in database
//
// For an EXISTING session:
//      Only activity/cart information is updated.
//
// ============================================================================

router.post("/track", async (req, res) => {

    try {

        const {
            sessionId,
            customerId,
            device,
            geo,
            trafficSource,
            clv,
            cart
        } = req.body;


        // --------------------------------------------------------------------
        // Validate required fields
        // --------------------------------------------------------------------

        if (!sessionId || !customerId) {

            return res.status(400).json({

                success: false,

                message:
                    "sessionId and customerId are required"
            });
        }


        // --------------------------------------------------------------------
        // Check whether session already exists
        // --------------------------------------------------------------------

        let session =
            await getSession(sessionId);


        // ====================================================================
        // EXISTING SESSION
        // ====================================================================

        if (session) {

            session =
                await updateSession(

                    sessionId,

                    {
                        lastActivity:
                            new Date()
                    }
                );


            // ---------------------------------------------------------------
            // Update/create cart if supplied
            // ---------------------------------------------------------------

            if (cart) {

                const existingCart =
                    await getCart(sessionId);


                if (!existingCart) {

                    await createCart({

                        cartId:
                            cart.cartId ||
                            `cart_${Date.now()}_${Math.random()
                                .toString(36)
                                .substring(2, 8)}`,

                        sessionId,

                        items:
                            cart.items || [],

                        totalValue:
                            Number(
                                cart.totalValue || 0
                            ),

                        categories:
                            cart.categories || []
                    });
                }
            }


            return res.status(200).json({

                success: true,

                message:
                    "Session tracked successfully",

                sessionId,

                session
            });
        }


        // ====================================================================
        // NEW SESSION
        // ====================================================================
        //
        // Session and Cart are created together.
        //
        // If Cart creation fails:
        //
        //      Session creation is rolled back.
        //
        // ====================================================================

        let createdSession;


        try {

            createdSession =
                await prisma.$transaction(
                    async (tx) => {

                        // ----------------------------------------------------
                        // Create session
                        // ----------------------------------------------------

                        const newSession =
                            await tx.session.create({

                                data: {

                                    sessionId,

                                    customerId,

                                    device:
                                        device ||
                                        "Unknown",

                                    geo:
                                        geo ||
                                        "Unknown",

                                    trafficSource:
                                        trafficSource ||
                                        "Direct",

                                    startTime:
                                        new Date(),

                                    lastActivity:
                                        new Date(),

                                    clv:
                                        Number(
                                            clv || 0
                                        ),

                                    status:
                                        "active"
                                }
                            });


                        // ----------------------------------------------------
                        // Create cart when supplied
                        // ----------------------------------------------------

                        let newCart = null;


                        if (cart) {

                            newCart =
                                await tx.cart.create({

                                    data: {

                                        cartId:
                                            cart.cartId ||
                                            `cart_${Date.now()}_${Math.random()
                                                .toString(36)
                                                .substring(2, 8)}`,

                                        sessionId,

                                        items:
                                            cart.items ||
                                            [],

                                        totalValue:
                                            Number(
                                                cart.totalValue ||
                                                0
                                            ),

                                        categories:
                                            cart.categories ||
                                            [],

                                        createdAt:
                                            new Date()
                                    }
                                });
                        }


                        // ----------------------------------------------------
                        // Return both records
                        // ----------------------------------------------------

                        return {

                            session:
                                newSession,

                            cart:
                                newCart
                        };
                    }
                );


            // ----------------------------------------------------------------
            // Audit ONLY after transaction succeeds
            // ----------------------------------------------------------------

            await addAudit(

                "SESSION_CREATED",

                {

                    sessionId,

                    customerId,

                    cartCreated:
                        Boolean(
                            createdSession.cart
                        )
                }
            );


        } catch (transactionError) {

            console.error(
                "Session transaction failed:",
                transactionError
            );


            return res.status(500).json({

                success: false,

                message:
                    "Failed to create session and cart",

                error:
                    transactionError.message
            });
        }


        // --------------------------------------------------------------------
        // Successful response
        // --------------------------------------------------------------------

        return res.status(200).json({

            success: true,

            message:
                "Session tracked successfully",

            sessionId,

            session:
                createdSession.session,

            cart:
                createdSession.cart
        });


    } catch (error) {

        console.error(
            "Session tracking error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to track session",

            error:
                error.message
        });
    }
});


// ============================================================================
// GET /api/sessions/:sessionId
// ============================================================================

router.get("/:sessionId", async (req, res) => {

    try {

        const session =
            await getSession(
                req.params.sessionId
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
                req.params.sessionId
            );


        return res.json({

            success: true,

            session,

            cart
        });


    } catch (error) {

        console.error(
            "Get session error:",
            error
        );


        return res.status(500).json({

            success: false,

            message:
                "Failed to fetch session",

            error:
                error.message
        });
    }
});


module.exports = router;