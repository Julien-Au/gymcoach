-- Durable audit records for explicitly confirmed MCP historical-equipment backfills.
-- References are intentionally stored as immutable scalar IDs/snapshots so the audit
-- survives later deletion of a gym, exercise, equipment item, or training set.
CREATE TABLE "McpHistoricalEquipmentBackfillAudit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "setIds" TEXT[],
    "equipmentSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),

    CONSTRAINT "McpHistoricalEquipmentBackfillAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "McpHistoricalEquipmentBackfillAudit_userId_createdAt_idx"
ON "McpHistoricalEquipmentBackfillAudit"("userId", "createdAt");
