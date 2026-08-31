-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('active', 'abandoned', 'recovered');

-- CreateEnum
CREATE TYPE "InterventionChannel" AS ENUM ('email', 'sms', 'push', 'in_app', 'none');

-- CreateEnum
CREATE TYPE "InterventionStatus" AS ENUM ('sent', 'opened', 'clicked', 'converted', 'control', 'blocked');

-- CreateTable
CREATE TABLE "sessions" (
    "session_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "device" TEXT,
    "geo" TEXT,
    "traffic_source" TEXT,
    "start_time" TIMESTAMP(3) NOT NULL,
    "last_activity" TIMESTAMP(3),
    "status" "SessionStatus" NOT NULL DEFAULT 'active',
    "clv" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "carts" (
    "cart_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "total_value" DOUBLE PRECISION NOT NULL,
    "categories" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "abandoned_at" TIMESTAMP(3),

    CONSTRAINT "carts_pkey" PRIMARY KEY ("cart_id")
);

-- CreateTable
CREATE TABLE "abandonment_contexts" (
    "context_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "last_action" TEXT,
    "time_at_checkout" TIMESTAMP(3) NOT NULL,
    "payment_error_code" TEXT,
    "root_cause_notes" TEXT,

    CONSTRAINT "abandonment_contexts_pkey" PRIMARY KEY ("context_id")
);

-- CreateTable
CREATE TABLE "interventions" (
    "intervention_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "channel" "InterventionChannel" NOT NULL,
    "offer_type" TEXT NOT NULL,
    "discount_depth" DOUBLE PRECISION NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL,
    "status" "InterventionStatus" NOT NULL,
    "is_control_group" BOOLEAN NOT NULL DEFAULT false,
    "converted_value" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "interventions_pkey" PRIMARY KEY ("intervention_id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "log_id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "compliance_checked" BOOLEAN NOT NULL,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateIndex
CREATE INDEX "sessions_customer_id_idx" ON "sessions"("customer_id");

-- CreateIndex
CREATE INDEX "sessions_status_idx" ON "sessions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "carts_session_id_key" ON "carts"("session_id");

-- CreateIndex
CREATE INDEX "carts_created_at_idx" ON "carts"("created_at");

-- CreateIndex
CREATE INDEX "abandonment_contexts_session_id_idx" ON "abandonment_contexts"("session_id");

-- CreateIndex
CREATE INDEX "abandonment_contexts_time_at_checkout_idx" ON "abandonment_contexts"("time_at_checkout");

-- CreateIndex
CREATE INDEX "interventions_customer_id_idx" ON "interventions"("customer_id");

-- CreateIndex
CREATE INDEX "interventions_session_id_idx" ON "interventions"("session_id");

-- CreateIndex
CREATE INDEX "interventions_sent_at_idx" ON "interventions"("sent_at");

-- CreateIndex
CREATE INDEX "interventions_channel_idx" ON "interventions"("channel");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "audit_logs_event_type_idx" ON "audit_logs"("event_type");

-- AddForeignKey
ALTER TABLE "carts" ADD CONSTRAINT "carts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "abandonment_contexts" ADD CONSTRAINT "abandonment_contexts_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interventions" ADD CONSTRAINT "interventions_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
