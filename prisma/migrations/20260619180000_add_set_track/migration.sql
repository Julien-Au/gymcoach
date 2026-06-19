-- Additive (issue #254): a downsampled pace/HR track of an imported cardio
-- activity, stored as a small JSON array on the cardio set. NULL on every
-- existing row, on strength sets, and on cardio logged without a track.
ALTER TABLE "Set" ADD COLUMN "track" JSONB;
