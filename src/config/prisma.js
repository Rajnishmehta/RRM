const { PrismaClient } = require("../../generated/prisma");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

require("dotenv").config();

if (!process.env.DATABASE_URL) {
    throw new Error(
        "DATABASE_URL is missing from .env"
    );
}

const pool = new Pool({
    connectionString:
        process.env.DATABASE_URL,
});

const adapter =
    new PrismaPg(pool);

const prisma =
    new PrismaClient({
        adapter,
    });

module.exports = {
    prisma,
    pool,
};