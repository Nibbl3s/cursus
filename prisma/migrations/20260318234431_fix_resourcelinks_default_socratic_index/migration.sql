-- AlterTable
ALTER TABLE "Task" ALTER COLUMN "resourceLinks" SET DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "SocraticDialogue_taskId_idx" ON "SocraticDialogue"("taskId");
