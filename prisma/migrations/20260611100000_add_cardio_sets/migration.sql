-- First-class cardio sets (issue #133). Additive only: a new enum value and
-- two nullable columns. Existing rows are untouched (both columns stay NULL
-- on every strength set).

-- AlterEnum
ALTER TYPE "ExerciseCategory" ADD VALUE 'CARDIO';

-- AlterTable
ALTER TABLE "Set" ADD COLUMN "durationSec" INTEGER,
ADD COLUMN "distanceM" DOUBLE PRECISION;
