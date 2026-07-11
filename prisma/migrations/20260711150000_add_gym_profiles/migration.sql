CREATE TYPE "EquipmentType" AS ENUM (
  'DUMBBELL',
  'BARBELL',
  'MACHINE',
  'CABLE',
  'BODYWEIGHT',
  'CARDIO',
  'OTHER'
);

ALTER TABLE "Exercise"
ADD COLUMN "equipmentType" "EquipmentType" NOT NULL DEFAULT 'OTHER';

UPDATE "Exercise" SET "equipmentType" = 'DUMBBELL'
WHERE lower("name") LIKE '%dumbbell%' OR lower("name") LIKE '%гантел%';
UPDATE "Exercise" SET "equipmentType" = 'CABLE'
WHERE lower("name") LIKE '%cable%' OR lower("name") LIKE '%pulldown%'
  OR lower("name") LIKE '%pushdown%' OR lower("name") LIKE '%блок%';
UPDATE "Exercise" SET "equipmentType" = 'MACHINE'
WHERE lower("name") LIKE '%machine%' OR lower("name") LIKE '%leg press%'
  OR lower("name") LIKE '%тренаж%' OR lower("name") LIKE '%жим ногами%';
UPDATE "Exercise" SET "equipmentType" = 'BARBELL'
WHERE lower("name") LIKE '%barbell%' OR lower("name") LIKE '%штанг%';
UPDATE "Exercise" SET "equipmentType" = 'BODYWEIGHT' WHERE "usesBodyweight" = true;
UPDATE "Exercise" SET "equipmentType" = 'CARDIO' WHERE "category" = 'CARDIO';

CREATE TABLE "Gym" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "dumbbellWeights" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "plateWeights" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "barWeights" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Gym_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GymExerciseConfig" (
  "id" TEXT NOT NULL,
  "gymId" TEXT NOT NULL,
  "exerciseId" TEXT NOT NULL,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "weightOptions" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
  CONSTRAINT "GymExerciseConfig_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "User" ADD COLUMN "activeGymId" TEXT;
ALTER TABLE "Session" ADD COLUMN "gymId" TEXT;

CREATE UNIQUE INDEX "Gym_userId_name_key" ON "Gym"("userId", "name");
CREATE INDEX "Gym_userId_updatedAt_idx" ON "Gym"("userId", "updatedAt");
CREATE UNIQUE INDEX "GymExerciseConfig_gymId_exerciseId_key"
  ON "GymExerciseConfig"("gymId", "exerciseId");
CREATE INDEX "GymExerciseConfig_exerciseId_idx" ON "GymExerciseConfig"("exerciseId");

ALTER TABLE "Gym"
  ADD CONSTRAINT "Gym_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GymExerciseConfig"
  ADD CONSTRAINT "GymExerciseConfig_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GymExerciseConfig"
  ADD CONSTRAINT "GymExerciseConfig_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "User"
  ADD CONSTRAINT "User_activeGymId_fkey" FOREIGN KEY ("activeGymId") REFERENCES "Gym"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Session"
  ADD CONSTRAINT "Session_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
