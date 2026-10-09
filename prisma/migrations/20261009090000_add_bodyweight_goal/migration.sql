-- Additive migration (issue #398): optional bodyweight goal. One nullable
-- column on User, no change to any other table or row. Null (every existing
-- user) means "no goal", which is the current behavior.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "bodyweightGoalKg" DOUBLE PRECISION;
