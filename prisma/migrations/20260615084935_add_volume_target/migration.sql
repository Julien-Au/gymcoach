-- CreateTable
CREATE TABLE "VolumeTarget" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "muscleGroup" "MuscleGroup" NOT NULL,
    "mev" INTEGER NOT NULL,
    "mrv" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VolumeTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VolumeTarget_userId_muscleGroup_key" ON "VolumeTarget"("userId", "muscleGroup");

-- AddForeignKey
ALTER TABLE "VolumeTarget" ADD CONSTRAINT "VolumeTarget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
