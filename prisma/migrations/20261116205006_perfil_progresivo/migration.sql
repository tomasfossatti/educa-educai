-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "profilePromptsDone" TEXT[] DEFAULT ARRAY[]::TEXT[];
