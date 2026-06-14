-- Additive (issue #203): maximum (peak) heart rate on a cardio set, imported
-- from a TCX file alongside the average. NULL on every existing row and on
-- manually logged sets.
ALTER TABLE "Set" ADD COLUMN "maxHr" INTEGER;
