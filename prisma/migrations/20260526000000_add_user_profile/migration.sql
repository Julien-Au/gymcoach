-- CreateEnum
CREATE TYPE "Sex" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "TrainingGoal" AS ENUM ('HYPERTROPHY', 'STRENGTH', 'FAT_LOSS', 'RECOMP', 'GENERAL_FITNESS');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "displayName" TEXT,
  ADD COLUMN "sex" "Sex",
  ADD COLUMN "heightCm" INTEGER,
  ADD COLUMN "goal" "TrainingGoal",
  ADD COLUMN "weeklyFrequency" INTEGER;
