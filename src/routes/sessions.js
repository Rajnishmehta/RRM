const express = require("express");
const router = express.Router();

const {
    createSession,
    getSession,
    updateSession,
    createCart,
    getCart,
    addAudit
} = require("../services/analyticsService");


// POST /api/sessions/track
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


        if (!sessionId || !customerId) {

            return res.status(400).json({
                success: false,
                message:
                    "sessionId and customerId are required"
            });

        }


        let session =
            await getSession(sessionId);


        // Create session if it doesn't exist
        if (!session) {

            session =
                await createSession({
                    sessionId,
                    customerId,
                    device,
                    geo,
                    trafficSource,
                    clv
                });

            await addAudit(
                "SESSION_CREATED",
                {
                    sessionId,
                    customerId
                }
            );
        }


        // Update activity
        else {

            session =
                await updateSession(
                    sessionId,
                    {
                        lastActivity:
                            new Date()
                    }
                );
        }


        // Create cart if supplied
        if (cart) {

            const existingCart =
                await getCart(sessionId);


            if (!existingCart) {

                await createCart({

                    cartId:
                        cart.cartId ||
                        `cart_${Date.now()}`,

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


// GET /api/sessions/:sessionId
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

        console.error(error);

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