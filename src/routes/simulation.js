const express = require("express");

const router = express.Router();

const {
    getSession,
    getLatestIntervention,
    recordConversion,
    addAudit
} = require("../services/analyticsService");

const {
    updateChannelStats
} = require("../engines/thompsonSampling");


/*
|--------------------------------------------------------------------------
| POST /api/simulation/convert
|--------------------------------------------------------------------------
|
| Simulates a customer conversion after a recovery intervention.
|
*/

router.post("/convert", async (req, res) => {

    try {

        const {
            sessionId,
            conversionValue
        } = req.body;


        /*
        |--------------------------------------------------------------------------
        | Validate request
        |--------------------------------------------------------------------------
        */

        if (!sessionId) {

            return res.status(400).json({

                success: false,

                message:
                    "sessionId is required"
            });
        }


        const value =
            Number(
                conversionValue || 0
            );


        if (value <= 0) {

            return res.status(400).json({

                success: false,

                message:
                    "conversionValue must be greater than 0"
            });
        }


        /*
        |--------------------------------------------------------------------------
        | Find session
        |--------------------------------------------------------------------------
        */

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


        /*
        |--------------------------------------------------------------------------
        | Find latest intervention
        |--------------------------------------------------------------------------
        */

        const intervention =
            await getLatestIntervention(
                sessionId
            );


        if (!intervention) {

            return res.status(404).json({

                success: false,

                message:
                    "No intervention found for session"
            });
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

            return res.status(400).json({

                success: false,

                message:
                    "Intervention has already been converted",

                interventionId:
                    intervention.interventionId
            });
        }


        /*
        |--------------------------------------------------------------------------
        | Record conversion
        |--------------------------------------------------------------------------
        */

        const result =
            await recordConversion(
                intervention,
                value
            );


        /*
        |--------------------------------------------------------------------------
        | Learning
        |--------------------------------------------------------------------------
        |
        | Only treatment interventions should update
        | Thompson Sampling.
        |
        */

        let learning = null;


        if (
            !intervention.isControlGroup &&
            intervention.channel !== "none"
        ) {

            try {

                learning =
                    await updateChannelStats(
                        intervention.channel,
                        true,
                        value
                    );

            } catch (learningError) {

                console.error(
                    "Learning error:",
                    learningError.message
                );

                learning = {

                    success: false,

                    error:
                        learningError.message
                };
            }
        }


        /*
        |--------------------------------------------------------------------------
        | Audit
        |--------------------------------------------------------------------------
        */

        await addAudit(

            "conversion_recorded",

            {

                sessionId,

                interventionId:
                    intervention.interventionId,

                customerId:
                    intervention.customerId,

                channel:
                    intervention.channel,

                conversionValue:
                    value,

                controlGroup:
                    intervention.isControlGroup

            },

            true
        );


        /*
        |--------------------------------------------------------------------------
        | Clean response objects
        |--------------------------------------------------------------------------
        */

        const interventionResponse = {

            interventionId:
                result.intervention.interventionId,

            sessionId:
                result.intervention.sessionId,

            customerId:
                result.intervention.customerId,

            channel:
                result.intervention.channel,

            offerType:
                result.intervention.offerType,

            discountDepth:
                result.intervention.discountDepth,

            status:
                result.intervention.status,

            convertedValue:
                result.intervention.convertedValue,

            isControlGroup:
                result.intervention.isControlGroup,

            sentAt:
                result.intervention.sentAt
        };


        const learningResponse =
            learning
                ? {

                    channel:
                        intervention.channel,

                    conversion:
                        true,

                    reward:
                        1,

                    success:
                        learning.success !== false,

                    alpha:
                        learning.alpha,

                    beta:
                        learning.beta,

                    attempts:
                        learning.attempts,

                    conversions:
                        learning.conversions,

                    revenue:
                        learning.revenue,

                    estimatedConversionRate:
                        learning.estimatedConversionRate

                }
                : {

                    channel:
                        intervention.channel,

                    conversion:
                        true,

                    reward:
                        1,

                    skipped:
                        intervention.isControlGroup

                };


        /*
        |--------------------------------------------------------------------------
        | Final response
        |--------------------------------------------------------------------------
        */

        return res.json({

            success: true,

            message:
                "Conversion recorded successfully",

            sessionId,

            customerId:
                intervention.customerId,

            conversionValue:
                value,

            recoveredRevenue:
                result.recoveredRevenue,

            controlGroup:
                intervention.isControlGroup,

            channel:
                intervention.channel,

            sessionStatus:
                result.session.status,

            intervention:
                interventionResponse,

            learning:
                learningResponse
        });


    } catch (error) {

        console.error(
            "Conversion error:",
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


module.exports = router;