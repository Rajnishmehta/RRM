require("dotenv").config();

const express = require("express");
const path = require("path");

const { prisma } = require("./src/config/prisma");

const sessionsRoutes =
    require("./src/routes/sessions");

const abandonmentRoutes =
    require("./src/routes/abandonment");

const analyticsRoutes =
    require("./src/routes/analytics");

const recoveryRoutes =
    require("./src/routes/recovery");

const simulationRoutes =
    require("./src/routes/simulation");


const app = express();

const PORT =
    Number(process.env.PORT) || 3000;


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
    express.json({
        limit: "1mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "1mb"
    })
);

app.disable("x-powered-by");


// ============================================================
// SECURITY HEADERS
// ============================================================

app.use((req, res, next) => {

    res.setHeader(
        "X-Content-Type-Options",
        "nosniff"
    );

    res.setHeader(
        "X-Frame-Options",
        "DENY"
    );

    res.setHeader(
        "Referrer-Policy",
        "strict-origin-when-cross-origin"
    );

    next();

});


// ============================================================
// REQUEST LOGGER
// ============================================================

app.use((req, res, next) => {

    const start =
        Date.now();


    res.on("finish", () => {

        const duration =
            Date.now() - start;


        console.log(
            `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
        );

    });


    next();

});


// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/health", async (req, res) => {

    try {

        await prisma.$queryRaw`
            SELECT 1;
        `;


        return res.status(200).json({

            success: true,

            status: "healthy",

            database: "connected",

            service: "RecoverIQ",

            timestamp:
                new Date().toISOString()

        });

    }

    catch (error) {

        console.error(
            "Health check failed:",
            error
        );


        return res.status(503).json({

            success: false,

            status: "unhealthy",

            database: "disconnected",

            service: "RecoverIQ",

            timestamp:
                new Date().toISOString()

        });

    }

});


// ============================================================
// API ROUTES
// ============================================================

// Session tracking

app.use(
    "/api/sessions",
    sessionsRoutes
);


// Abandonment detection

app.use(
    "/api/abandonment",
    abandonmentRoutes
);


// Recovery decision + intervention

app.use(
    "/api/recovery",
    recoveryRoutes
);


// Conversion simulation

app.use(
    "/api/simulation",
    simulationRoutes
);


// Analytics

app.use(
    "/api/analytics",
    analyticsRoutes
);


// ============================================================
// API INFORMATION
// ============================================================

app.get("/api", (req, res) => {

    res.json({

        name:
            "RecoverIQ Checkout Abandonment Recovery API",

        version:
            "1.0.0",

        status:
            "running",

        endpoints: {

            health:
                "GET /health",

            sessions:
                "POST /api/sessions/track",

            getSession:
                "GET /api/sessions/:sessionId",

            abandonment:
                "POST /api/abandonment/evaluate",

            recovery:
                "POST /api/recovery/execute",

            conversion:
                "POST /api/simulation/convert",

            analytics:
                "GET /api/analytics/metrics"

        }

    });

});


// ============================================================
// FRONTEND
// ============================================================

app.use(
    express.static(
        path.join(
            __dirname,
            "public"
        )
    )
);


// ============================================================
// ROOT
// ============================================================

app.get("/", (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


// ============================================================
// 404 HANDLER
// ============================================================

app.use((req, res) => {

    res.status(404).json({

        success: false,

        message:
            "Route not found",

        path:
            req.originalUrl

    });

});


// ============================================================
// GLOBAL ERROR HANDLER
// ============================================================

app.use(
    (error, req, res, next) => {

        console.error(
            "Unhandled server error:",
            error
        );


        if (res.headersSent) {

            return next(error);

        }


        res.status(
            error.status || 500
        ).json({

            success: false,

            message:
                error.message ||
                "Internal server error"

        });

    }
);


// ============================================================
// START SERVER
// ============================================================

async function startServer() {

    try {

        // ----------------------------------------------------
        // Test PostgreSQL connection
        // ----------------------------------------------------

        await prisma.$queryRaw`
            SELECT 1;
        `;


        console.log("");

        console.log(
            "========================================"
        );

        console.log(
            "       RECOVERIQ BACKEND"
        );

        console.log(
            "========================================"
        );

        console.log(
            "Database: PostgreSQL"
        );

        console.log(
            "Database: Connected"
        );


        // ----------------------------------------------------
        // Start HTTP server
        // ----------------------------------------------------

        const server =
            app.listen(
                PORT,
                () => {

                    console.log(
                        `Server running on http://localhost:${PORT}`
                    );

                    console.log(
                        `Health: http://localhost:${PORT}/health`
                    );

                    console.log(
                        `API: http://localhost:${PORT}/api`
                    );

                    console.log(
                        "----------------------------------------"
                    );

                    console.log(
                        "POST /api/sessions/track"
                    );

                    console.log(
                        "GET  /api/sessions/:sessionId"
                    );

                    console.log(
                        "POST /api/abandonment/evaluate"
                    );

                    console.log(
                        "POST /api/recovery/execute"
                    );

                    console.log(
                        "POST /api/simulation/convert"
                    );

                    console.log(
                        "GET  /api/analytics/metrics"
                    );

                    console.log(
                        "----------------------------------------"
                    );

                }
            );


        // ----------------------------------------------------
        // Graceful shutdown
        // ----------------------------------------------------

        const shutdown =
            async (signal) => {

                console.log(
                    `\n${signal} received`
                );


                server.close(
                    async () => {

                        try {

                            await prisma.$disconnect();


                            console.log(
                                "PostgreSQL disconnected"
                            );


                            process.exit(0);

                        }

                        catch (error) {

                            console.error(
                                "Shutdown error:",
                                error
                            );


                            process.exit(1);

                        }

                    }
                );

            };


        // ----------------------------------------------------
        // Shutdown signals
        // ----------------------------------------------------

        process.on(
            "SIGINT",
            () => shutdown("SIGINT")
        );


        process.on(
            "SIGTERM",
            () => shutdown("SIGTERM")
        );

    }

    catch (error) {

        console.error("");

        console.error(
            "========================================"
        );

        console.error(
            "RECOVERIQ FAILED TO START"
        );

        console.error(
            "========================================"
        );

        console.error(error);


        try {

            await prisma.$disconnect();

        }

        catch (disconnectError) {

            console.error(
                "Database disconnect error:",
                disconnectError
            );

        }


        process.exit(1);

    }

}


// ============================================================
// START APPLICATION
// ============================================================

startServer();