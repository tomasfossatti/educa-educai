-- CreateEnum
CREATE TYPE "SignalStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISCARDED');

-- CreateEnum
CREATE TYPE "AccessView" AS ENUM ('STUDENT_FILE', 'EVIDENCE', 'CONVERSATION', 'PROJECT_LINKS');

-- AlterTable
ALTER TABLE "FolderContext" ADD COLUMN     "courseIds" TEXT[];

-- AlterTable
ALTER TABLE "Signal" ADD COLUMN     "confidence" "Confidence",
ADD COLUMN     "respondedAt" TIMESTAMP(3),
ADD COLUMN     "studentStatus" "SignalStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "AccessLog" (
    "id" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "courseId" TEXT,
    "view" "AccessView" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccessLog_studentId_createdAt_idx" ON "AccessLog"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccessLog" ADD CONSTRAINT "AccessLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;
