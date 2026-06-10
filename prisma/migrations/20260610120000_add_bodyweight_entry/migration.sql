-- Additive migration (issue #99): bodyweight measurement history. New table
-- only, no change to existing tables. User.bodyweight stays the "current
-- value" the rest of the app reads.

-- CreateTable
CREATE TABLE "BodyweightEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "measuredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT,
    CONSTRAINT "BodyweightEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BodyweightEntry_userId_measuredAt_idx" ON "BodyweightEntry"("userId", "measuredAt");

-- AddForeignKey
ALTER TABLE "BodyweightEntry" ADD CONSTRAINT "BodyweightEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
