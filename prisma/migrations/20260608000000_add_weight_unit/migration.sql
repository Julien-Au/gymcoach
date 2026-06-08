-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LB');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "unit" "WeightUnit" NOT NULL DEFAULT 'KG';
