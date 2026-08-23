-- Physical gym equipment is additive to the accepted saved-gym model.
-- IF NOT EXISTS keeps this migration compatible with forks that already
-- shipped the same tables under an earlier migration id.
CREATE TABLE IF NOT EXISTS "GymEquipment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" "EquipmentType" NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "modelName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightOptions" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "imageUrl" TEXT,
    "imageData" BYTEA,
    "imageMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GymEquipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GymEquipmentExercise" (
    "equipmentId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    CONSTRAINT "GymEquipmentExercise_pkey" PRIMARY KEY ("equipmentId", "exerciseId")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GymEquipment_gymId_name_key"
    ON "GymEquipment"("gymId", "name");
CREATE INDEX IF NOT EXISTS "GymEquipment_gymId_equipmentType_idx"
    ON "GymEquipment"("gymId", "equipmentType");
CREATE INDEX IF NOT EXISTS "GymEquipmentExercise_exerciseId_idx"
    ON "GymEquipmentExercise"("exerciseId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GymEquipment_gymId_fkey') THEN
    ALTER TABLE "GymEquipment"
      ADD CONSTRAINT "GymEquipment_gymId_fkey"
      FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GymEquipmentExercise_equipmentId_fkey') THEN
    ALTER TABLE "GymEquipmentExercise"
      ADD CONSTRAINT "GymEquipmentExercise_equipmentId_fkey"
      FOREIGN KEY ("equipmentId") REFERENCES "GymEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GymEquipmentExercise_exerciseId_fkey') THEN
    ALTER TABLE "GymEquipmentExercise"
      ADD CONSTRAINT "GymEquipmentExercise_exerciseId_fkey"
      FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
