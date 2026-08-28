-- CreateTable
CREATE TABLE "GymEquipment" (
    "id" TEXT NOT NULL,
    "gymId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "equipmentType" "EquipmentType" NOT NULL,
    "description" TEXT,
    "manufacturer" TEXT,
    "modelName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "weightOptions" DOUBLE PRECISION[] NOT NULL DEFAULT ARRAY[]::DOUBLE PRECISION[],
    "imageUrl" TEXT,
    "imageData" BYTEA,
    "imageMimeType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GymEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GymEquipmentExercise" (
    "equipmentId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,

    CONSTRAINT "GymEquipmentExercise_pkey" PRIMARY KEY ("equipmentId", "exerciseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "GymEquipment_gymId_name_key" ON "GymEquipment"("gymId", "name");

-- CreateIndex
CREATE INDEX "GymEquipment_gymId_equipmentType_idx" ON "GymEquipment"("gymId", "equipmentType");

-- CreateIndex
CREATE INDEX "GymEquipmentExercise_exerciseId_idx" ON "GymEquipmentExercise"("exerciseId");

-- AddForeignKey
ALTER TABLE "GymEquipment" ADD CONSTRAINT "GymEquipment_gymId_fkey" FOREIGN KEY ("gymId") REFERENCES "Gym"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEquipmentExercise" ADD CONSTRAINT "GymEquipmentExercise_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "GymEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GymEquipmentExercise" ADD CONSTRAINT "GymEquipmentExercise_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE CASCADE ON UPDATE CASCADE;
