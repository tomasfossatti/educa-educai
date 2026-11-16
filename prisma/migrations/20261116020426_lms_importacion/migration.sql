-- CreateEnum
CREATE TYPE "LmsProvider" AS ENUM ('CANVAS', 'MOODLE');

-- CreateEnum
CREATE TYPE "LmsImportStatus" AS ENUM ('RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Material" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "module" TEXT,
ADD COLUMN     "sourceUrl" TEXT,
ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MaterialChunk" ADD COLUMN     "folderId" TEXT,
ALTER COLUMN "courseId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "LmsConnection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "LmsProvider" NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "credential" TEXT NOT NULL,
    "authKind" TEXT NOT NULL DEFAULT 'token',
    "accountName" TEXT,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LmsConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LmsImport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "LmsProvider" NOT NULL,
    "lmsCourseId" TEXT NOT NULL,
    "lmsCourseName" TEXT NOT NULL,
    "courseId" TEXT,
    "folderId" TEXT,
    "status" "LmsImportStatus" NOT NULL DEFAULT 'RUNNING',
    "total" INTEGER NOT NULL DEFAULT 0,
    "done" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "modules" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LmsImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LmsConnection_userId_key" ON "LmsConnection"("userId");

-- CreateIndex
CREATE INDEX "LmsImport_userId_createdAt_idx" ON "LmsImport"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Material_folderId_status_idx" ON "Material"("folderId", "status");

-- CreateIndex
CREATE INDEX "MaterialChunk_folderId_idx" ON "MaterialChunk"("folderId");

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialChunk" ADD CONSTRAINT "MaterialChunk_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsConnection" ADD CONSTRAINT "LmsConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsImport" ADD CONSTRAINT "LmsImport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsImport" ADD CONSTRAINT "LmsImport_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LmsImport" ADD CONSTRAINT "LmsImport_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cada material y cada fragmento pertenece a una cátedra o a una carpeta, nunca a las dos ni a ninguna.
ALTER TABLE "Material" ADD CONSTRAINT "Material_owner_check" CHECK (("courseId" IS NULL) <> ("folderId" IS NULL));
ALTER TABLE "MaterialChunk" ADD CONSTRAINT "MaterialChunk_owner_check" CHECK (("courseId" IS NULL) <> ("folderId" IS NULL));
