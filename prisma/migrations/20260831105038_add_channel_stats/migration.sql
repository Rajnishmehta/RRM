-- CreateTable
CREATE TABLE "channel_stats" (
    "channel" "InterventionChannel" NOT NULL,
    "alpha" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "beta" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "conversions" INTEGER NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_stats_pkey" PRIMARY KEY ("channel")
);
