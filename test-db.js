const {
    prisma,
    pool
} = require("./src/config/prisma");


async function testDatabase() {

    try {

        const result =
            await prisma.$queryRaw`
                SELECT
                    NOW() AS current_time;
            `;

        console.log(
            "================================"
        );

        console.log(
            "DATABASE CONNECTION SUCCESS"
        );

        console.log(
            "PostgreSQL time:",
            result[0].current_time
        );

        console.log(
            "================================"
        );

    } catch (error) {

        console.error(
            "DATABASE CONNECTION FAILED"
        );

        console.error(
            error
        );

    } finally {

        await prisma.$disconnect();

        await pool.end();
    }
}


testDatabase();