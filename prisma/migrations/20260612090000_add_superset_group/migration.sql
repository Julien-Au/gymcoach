-- Superset pairing (issue #146, slice 1): additive nullable column. Exercises
-- of the same workout sharing a group number form a superset; NULL (the
-- default for every existing row) means standalone. No backfill, no
-- constraint beyond the column - bounds live in the Zod schema.
ALTER TABLE "ProgramExercise" ADD COLUMN "supersetGroup" INTEGER;
