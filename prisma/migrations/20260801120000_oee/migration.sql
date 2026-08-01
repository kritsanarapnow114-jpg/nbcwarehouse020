-- CreateEnum
CREATE TYPE "OeeOperation" AS ENUM ('PRODUCTION', 'UNLOADING');

-- CreateTable
CREATE TABLE "OeeMachine" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "operation" "OeeOperation" NOT NULL DEFAULT 'PRODUCTION',
    "standardRate" DOUBLE PRECISION NOT NULL,
    "rateUnit" TEXT NOT NULL DEFAULT 'kg/hr',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OeeMachine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OeeMachine_operation_idx" ON "OeeMachine"("operation");

-- CreateTable
CREATE TABLE "Downtime" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "Downtime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Downtime_receiptId_idx" ON "Downtime"("receiptId");

-- AlterTable
ALTER TABLE "Receipt" ADD COLUMN     "oeeMachineId" TEXT;
ALTER TABLE "Receipt" ADD COLUMN     "plannedMin" INTEGER;
ALTER TABLE "Receipt" ADD COLUMN     "breakMin" INTEGER;
ALTER TABLE "Receipt" ADD COLUMN     "oeeReject" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "Receipt_oeeMachineId_idx" ON "Receipt"("oeeMachineId");

-- AddForeignKey
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_oeeMachineId_fkey" FOREIGN KEY ("oeeMachineId") REFERENCES "OeeMachine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Downtime" ADD CONSTRAINT "Downtime_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
