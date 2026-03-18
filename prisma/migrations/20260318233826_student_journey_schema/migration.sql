-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TaskType" ADD VALUE 'GUIDED_QUESTIONS';
ALTER TYPE "TaskType" ADD VALUE 'FILE_UPLOAD';
ALTER TYPE "TaskType" ADD VALUE 'PEER_BOARD';

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "scenarioText" TEXT;

-- AlterTable
ALTER TABLE "SocraticDialogue" ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "guidedQuestions" JSONB,
ADD COLUMN     "isOptional" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "learningObjective" TEXT,
ADD COLUMN     "prompt" TEXT,
ADD COLUMN     "resourceLinks" TEXT[],
ADD COLUMN     "starterFileUrl" TEXT;

-- AlterTable
ALTER TABLE "TaskCompletion" ADD COLUMN     "completionData" JSONB;

-- AddForeignKey
ALTER TABLE "SocraticDialogue" ADD CONSTRAINT "SocraticDialogue_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;
