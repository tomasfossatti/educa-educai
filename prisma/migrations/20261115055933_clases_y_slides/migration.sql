-- CreateTable
CREATE TABLE "ClassSession" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "objective" TEXT,
    "slidesDraft" JSONB,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassSessionItem" (
    "classSessionId" TEXT NOT NULL,
    "curriculumItemId" TEXT NOT NULL,

    CONSTRAINT "ClassSessionItem_pkey" PRIMARY KEY ("classSessionId","curriculumItemId")
);

-- CreateIndex
CREATE INDEX "ClassSession_courseId_date_idx" ON "ClassSession"("courseId", "date");

-- AddForeignKey
ALTER TABLE "ClassSession" ADD CONSTRAINT "ClassSession_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionItem" ADD CONSTRAINT "ClassSessionItem_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassSessionItem" ADD CONSTRAINT "ClassSessionItem_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
