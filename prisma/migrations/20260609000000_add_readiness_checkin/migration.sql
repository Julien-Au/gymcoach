-- CreateTable
CREATE TABLE "ReadinessCheckin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readiness" INTEGER NOT NULL,
    "sleepQuality" INTEGER NOT NULL,
    "soreness" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadinessCheckin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReadinessCheckin_userId_createdAt_idx" ON "ReadinessCheckin"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReadinessCheckin" ADD CONSTRAINT "ReadinessCheckin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
