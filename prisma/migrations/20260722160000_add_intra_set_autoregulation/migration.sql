CREATE TYPE "SetAutoregulationMode" AS ENUM ('PRESERVE_RIR', 'PRESERVE_REPS');

ALTER TABLE "ProgramExercise"
ADD COLUMN "autoregulationMode" "SetAutoregulationMode" NOT NULL DEFAULT 'PRESERVE_RIR',
ADD COLUMN "fatigueRate" DOUBLE PRECISION,
ADD COLUMN "loadAdjustmentPct" DOUBLE PRECISION;
