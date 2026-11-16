-- AlterTable
ALTER TABLE "LmsConnection" ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "LmsExtensionLink" ADD COLUMN     "lastError" TEXT,
ADD COLUMN     "lastErrorAt" TIMESTAMP(3);
