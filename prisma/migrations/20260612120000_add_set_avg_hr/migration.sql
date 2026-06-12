-- Additive (issue #152): average heart rate on a cardio set, imported from a
-- TCX file. NULL on every existing row and on manually logged sets.
ALTER TABLE "Set" ADD COLUMN "avgHr" INTEGER;
