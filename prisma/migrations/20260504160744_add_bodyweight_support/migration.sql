-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "usesBodyweight" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bodyweight" DOUBLE PRECISION;
