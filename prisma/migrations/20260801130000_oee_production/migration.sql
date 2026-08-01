-- AlterTable: OEE capture for production receipts (columns only, no new table)
ALTER TABLE "Receipt" ADD COLUMN     "oeeLine" TEXT;
ALTER TABLE "Receipt" ADD COLUMN     "plannedMin" INTEGER;
ALTER TABLE "Receipt" ADD COLUMN     "breakMin" INTEGER;
ALTER TABLE "Receipt" ADD COLUMN     "downtime" JSONB;
