-- Additive migration (issue #90): per-exercise target goals. New table only,
-- no change to existing tables.

-- CreateTable
CREATE TABLE "ExerciseGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "targetWeight" DOUBLE PRECISION NOT NULL,
    "targetReps" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "achievedAt" TIMESTAMP(3),
    CONSTRAINT "ExerciseGoal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExerciseGoal_userId_exerciseId_key" ON "ExerciseGoal"("userId", "exerciseId");

-- AddForeignKey
ALTER TABLE "ExerciseGoal" ADD CONSTRAINT "ExerciseGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExerciseGoal" ADD CONSTRAINT "ExerciseGoal_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
