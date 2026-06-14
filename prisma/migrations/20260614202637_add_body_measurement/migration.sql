-- Additive migration (issue #202): tape-measure body-measurement history,
-- mirroring BodyweightEntry (#99). New enum + table + index only; no change to
-- existing tables and nothing else in the app reads it.

-- CreateEnum
CREATE TYPE "BodyMeasurementSite" AS ENUM ('WAIST', 'HIPS', 'CHEST', 'SHOULDERS', 'NECK', 'ARM_LEFT', 'ARM_RIGHT', 'FOREARM_LEFT', 'FOREARM_RIGHT', 'THIGH_LEFT', 'THIGH_RIGHT', 'CALF_LEFT', 'CALF_RIGHT');

-- CreateTable
CREATE TABLE "BodyMeasurement" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "site" "BodyMeasurementSite" NOT NULL,
    "valueCm" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,

    CONSTRAINT "BodyMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyMeasurement_userId_site_measuredAt_idx" ON "BodyMeasurement"("userId", "site", "measuredAt");

-- AddForeignKey
ALTER TABLE "BodyMeasurement" ADD CONSTRAINT "BodyMeasurement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
