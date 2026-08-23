-- Preserve the concrete equipment used for each set. The columns are additive
-- and guarded so forks that already shipped the same history fields can adopt
-- this migration id without rebuilding user data.
ALTER TABLE "Set"
  ADD COLUMN IF NOT EXISTS "gymEquipmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "equipmentNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "selectedLoadKg" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "selectedLoadMultiplierSnapshot" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "nominalResistanceKg" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "equipmentLoadSnapshot" JSONB;

CREATE INDEX IF NOT EXISTS "Set_gymEquipmentId_completedAt_idx"
  ON "Set"("gymEquipmentId", "completedAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Set_gymEquipmentId_fkey') THEN
    ALTER TABLE "Set"
      ADD CONSTRAINT "Set_gymEquipmentId_fkey"
      FOREIGN KEY ("gymEquipmentId") REFERENCES "GymEquipment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
