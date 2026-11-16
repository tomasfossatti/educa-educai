-- CreateEnum
CREATE TYPE "PersonalizationFocus" AS ENUM ('WORK', 'PROJECT');

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "personalizationFocus" "PersonalizationFocus" NOT NULL DEFAULT 'PROJECT';
