-- pgvector para los embeddings del material.
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ConversationOrigin" AS ENUM ('CHAT', 'UPLOAD');

-- CreateEnum
CREATE TYPE "FolderKind" AS ENUM ('SUBJECT', 'PROJECT');

-- CreateEnum
CREATE TYPE "FolderCreator" AS ENUM ('LMS', 'MANUAL', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ContextLayer" AS ENUM ('TRACE', 'FACTS', 'SUMMARY');

-- CreateEnum
CREATE TYPE "MaterialStatus" AS ENUM ('PROCESSING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "AIConversation" ADD COLUMN     "folderId" TEXT,
ADD COLUMN     "origin" "ConversationOrigin" NOT NULL DEFAULT 'CHAT',
ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Experience" ALTER COLUMN "courseId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "citations" JSONB;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "career" TEXT,
ADD COLUMN     "consentWithdrawnAt" TIMESTAMP(3),
ADD COLUMN     "projectDescription" TEXT,
ADD COLUMN     "studyYear" INTEGER;

-- CreateTable
CREATE TABLE "Folder" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "kind" "FolderKind" NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" "FolderCreator" NOT NULL DEFAULT 'SYSTEM',
    "courseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FolderContext" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "layer" "ContextLayer" NOT NULL,
    "content" TEXT NOT NULL,
    "sourceIds" TEXT[],
    "editedByStudent" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FolderContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "uploadedById" TEXT NOT NULL,
    "status" "MaterialStatus" NOT NULL DEFAULT 'PROCESSING',
    "error" TEXT,
    "pageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialChunk" (
    "id" TEXT NOT NULL,
    "materialId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "page" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "embedding" vector(1024),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Folder_studentId_kind_idx" ON "Folder"("studentId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Folder_studentId_courseId_key" ON "Folder"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "FolderContext_folderId_layer_idx" ON "FolderContext"("folderId", "layer");

-- CreateIndex
CREATE INDEX "Material_courseId_status_idx" ON "Material"("courseId", "status");

-- CreateIndex
CREATE INDEX "MaterialChunk_courseId_idx" ON "MaterialChunk"("courseId");

-- CreateIndex
CREATE INDEX "MaterialChunk_materialId_page_idx" ON "MaterialChunk"("materialId", "page");

-- CreateIndex
CREATE INDEX "AIConversation_folderId_idx" ON "AIConversation"("folderId");

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Folder" ADD CONSTRAINT "Folder_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FolderContext" ADD CONSTRAINT "FolderContext_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "Folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Material" ADD CONSTRAINT "Material_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialChunk" ADD CONSTRAINT "MaterialChunk_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialChunk" ADD CONSTRAINT "MaterialChunk_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Búsqueda de texto completo en español sobre el material (índice de expresión).
CREATE INDEX "MaterialChunk_text_fts_idx" ON "MaterialChunk" USING GIN (to_tsvector('spanish', "text"));

-- Datos existentes: cada estudiante recibe la carpeta de cada materia en la que está inscripto,
-- y sus conversaciones previas quedan en esa carpeta. Solo agrega filas; no borra ni transforma datos.
INSERT INTO "Folder" ("id", "studentId", "kind", "name", "createdBy", "courseId", "createdAt", "updatedAt")
SELECT 'fld_' || md5(e."studentId" || e."courseId"), e."studentId", 'SUBJECT', c."name", 'SYSTEM', e."courseId", now(), now()
FROM "Enrollment" e JOIN "Course" c ON c."id" = e."courseId"
ON CONFLICT DO NOTHING;

UPDATE "AIConversation" a SET "folderId" = f."id"
FROM "Folder" f
WHERE a."folderId" IS NULL AND f."studentId" = a."studentId" AND f."courseId" = a."courseId";
