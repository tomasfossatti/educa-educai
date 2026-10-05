-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "CurriculumStatus" AS ENUM ('NOT_STARTED', 'EXTRACTING', 'IN_REVIEW', 'CONFIGURED', 'FAILED');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'REMOVED');

-- CreateEnum
CREATE TYPE "CurriculumKind" AS ENUM ('CONCEPT', 'OBJECTIVE', 'COMPETENCY', 'CRITERION');

-- CreateEnum
CREATE TYPE "CurriculumOrigin" AS ENUM ('AI_PROPOSED', 'TEACHER');

-- CreateEnum
CREATE TYPE "CurriculumItemStatus" AS ENUM ('PROPOSED', 'ACCEPTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('AI_CONVERSATION', 'CHALLENGE');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'CLOSED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('STUDENT', 'TUTOR');

-- CreateEnum
CREATE TYPE "ActivityKind" AS ENUM ('BASELINE', 'CHALLENGE', 'PRACTICE');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DeclaredAssistance" AS ENUM ('NONE', 'TUTOR_ONLY', 'EXTERNAL_AI_PARTIAL', 'EXTERNAL_AI_EXTENSIVE', 'PEER_OR_OTHER');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED');

-- CreateEnum
CREATE TYPE "EvidenceSource" AS ENUM ('AI_CONVERSATION', 'CHALLENGE_SUBMISSION');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'INSUFFICIENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('QUESTION', 'EXPLANATION', 'ATTEMPT', 'ERROR', 'DECISION', 'JUSTIFICATION', 'HYPOTHESIS', 'ANALYSIS', 'REFLECTION', 'ANSWER');

-- CreateEnum
CREATE TYPE "AssistanceLevel" AS ENUM ('NONE', 'LOW', 'MEDIUM', 'HIGH', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AssistanceSource" AS ENUM ('OBSERVED', 'DECLARED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "Dimension" AS ENUM ('COMPREHENSION', 'APPLICATION', 'TRANSFER', 'AUTONOMY');

-- CreateEnum
CREATE TYPE "Polarity" AS ENUM ('STRENGTH', 'DIFFICULTY', 'MIXED');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('CONSISTENT', 'PARTIAL', 'INSUFFICIENT', 'CONTRADICTORY');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PARTIALLY_CORRECT', 'INCORRECT', 'NEEDS_CONTEXT');

-- CreateEnum
CREATE TYPE "InferenceState" AS ENUM ('ACTIVE', 'SUPERSEDED', 'RETRACTED');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "SupportRelation" AS ENUM ('SUPPORTS', 'CONTRADICTS');

-- CreateEnum
CREATE TYPE "EvaluationResult" AS ENUM ('MEETS', 'PARTIALLY_MEETS', 'DOES_NOT_MEET', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "ReviewVerdict" AS ENUM ('CONFIRMED', 'PARTIALLY_CORRECT', 'INCORRECT', 'NEEDS_CONTEXT');

-- CreateEnum
CREATE TYPE "StudentStance" AS ENUM ('AGREE', 'DISAGREE', 'MISSING_CONTEXT');

-- CreateEnum
CREATE TYPE "InterventionType" AS ENUM ('EXPLAIN', 'ASK', 'REGROUP', 'PRACTICE', 'FEEDBACK', 'NEW_CHALLENGE', 'OTHER');

-- CreateEnum
CREATE TYPE "SnapshotDimension" AS ENUM ('COMPREHENSION', 'APPLICATION', 'TRANSFER', 'AUTONOMY', 'CONSISTENCY', 'EVOLUTION');

-- CreateEnum
CREATE TYPE "ActionAudience" AS ENUM ('STUDENT', 'TEACHER');

-- CreateEnum
CREATE TYPE "ActionSource" AS ENUM ('ENGINE', 'TEACHER');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('REVIEW_CONCEPT', 'PRACTICE_WITH_TUTOR', 'TRY_ACTIVITY', 'REFLECT', 'TEACHER_MESSAGE', 'EXPLAIN_IN_CLASS', 'ASK_STUDENT', 'REGROUP', 'ASSIGN_PRACTICE', 'GIVE_FEEDBACK', 'PROPOSE_CHALLENGE');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('OPEN', 'DONE', 'DISMISSED');

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentProfile" (
    "userId" TEXT NOT NULL,
    "declaredCurrentContext" TEXT,
    "declaredInterests" TEXT,
    "declaredGoals" TEXT,
    "declaredStrengths" TEXT,
    "declaredDifficulties" TEXT,
    "declaredWorkPreferences" TEXT,
    "declaredUpdatedAt" TIMESTAMP(3),
    "consentAnalysisAt" TIMESTAMP(3),
    "consentVersion" TEXT,
    "shareContextWithTeachers" BOOLEAN NOT NULL DEFAULT false,
    "onboardingCompletedAt" TIMESTAMP(3),

    CONSTRAINT "StudentProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "TeacherProfile" (
    "userId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,

    CONSTRAINT "TeacherProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "joinCode" TEXT NOT NULL,
    "programText" TEXT,
    "programFileName" TEXT,
    "curriculumStatus" "CurriculumStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "curriculumError" TEXT,
    "curriculumConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Enrollment" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Enrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseInvite" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),

    CONSTRAINT "CourseInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumItem" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "kind" "CurriculumKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "origin" "CurriculumOrigin" NOT NULL,
    "status" "CurriculumItemStatus" NOT NULL DEFAULT 'PROPOSED',
    "sourceExcerpt" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Experience" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "ExperienceType" NOT NULL,
    "title" TEXT NOT NULL,
    "activityId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Experience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIConversation" (
    "id" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "activityId" TEXT,
    "focusItemId" TEXT,
    "suggestedActionId" TEXT,
    "title" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "AIConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" "ActivityKind" NOT NULL,
    "scenario" TEXT NOT NULL,
    "instructions" TEXT NOT NULL,
    "prompts" JSONB NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityCurriculumItem" (
    "activityId" TEXT NOT NULL,
    "curriculumItemId" TEXT NOT NULL,

    CONSTRAINT "ActivityCurriculumItem_pkey" PRIMARY KEY ("activityId","curriculumItemId")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "answers" JSONB NOT NULL,
    "declaredAssistance" "DeclaredAssistance",
    "assistanceNote" TEXT,
    "confidence" "Confidence",
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterpretationRun" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "source" "EvidenceSource" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "insufficient" JSONB NOT NULL DEFAULT '[]',
    "statusNote" TEXT,
    "error" TEXT,
    "promptVersion" TEXT NOT NULL,
    "origin" TEXT NOT NULL DEFAULT 'engine',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "InterpretationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceObject" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "runId" TEXT,
    "source" "EvidenceSource" NOT NULL,
    "kind" "EvidenceKind" NOT NULL,
    "observation" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "context" TEXT,
    "assistanceLevel" "AssistanceLevel" NOT NULL DEFAULT 'UNKNOWN',
    "assistanceSource" "AssistanceSource" NOT NULL DEFAULT 'UNKNOWN',
    "assistanceNote" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "provenance" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceCurriculumItem" (
    "evidenceId" TEXT NOT NULL,
    "curriculumItemId" TEXT NOT NULL,

    CONSTRAINT "EvidenceCurriculumItem_pkey" PRIMARY KEY ("evidenceId","curriculumItemId")
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "runId" TEXT,
    "dimension" "Dimension" NOT NULL,
    "polarity" "Polarity" NOT NULL,
    "description" TEXT NOT NULL,
    "rationale" TEXT,
    "curriculumItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Signal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inference" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "runId" TEXT,
    "statement" TEXT NOT NULL,
    "studentStatement" TEXT NOT NULL,
    "dimension" "Dimension" NOT NULL,
    "polarity" "Polarity" NOT NULL,
    "curriculumItemId" TEXT,
    "supportStatus" "SupportStatus" NOT NULL,
    "proposedSupportStatus" "SupportStatus" NOT NULL,
    "supportRationale" TEXT NOT NULL,
    "policyNotes" JSONB NOT NULL DEFAULT '[]',
    "contradictionNote" TEXT,
    "requiresReview" BOOLEAN NOT NULL DEFAULT true,
    "reviewStatus" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "state" "InferenceState" NOT NULL DEFAULT 'ACTIVE',
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InferenceSupport" (
    "id" TEXT NOT NULL,
    "inferenceId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "relation" "SupportRelation" NOT NULL,

    CONSTRAINT "InferenceSupport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "runId" TEXT,
    "result" "EvaluationResult" NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvaluationEvidence" (
    "evaluationId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,

    CONSTRAINT "EvaluationEvidence_pkey" PRIMARY KEY ("evaluationId","evidenceId")
);

-- CreateTable
CREATE TABLE "TeacherReview" (
    "id" TEXT NOT NULL,
    "inferenceId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "verdict" "ReviewVerdict" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentResponse" (
    "id" TEXT NOT NULL,
    "inferenceId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "stance" "StudentStance" NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Intervention" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "type" "InterventionType" NOT NULL,
    "description" TEXT NOT NULL,
    "messageToStudents" TEXT,
    "activityId" TEXT,
    "inferenceId" TEXT,
    "curriculumItemId" TEXT,
    "insightKey" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "followUpEvidenceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Intervention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterventionTarget" (
    "interventionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,

    CONSTRAINT "InterventionTarget_pkey" PRIMARY KEY ("interventionId","studentId")
);

-- CreateTable
CREATE TABLE "DevelopmentSnapshot" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "runId" TEXT,
    "evidenceCount" INTEGER NOT NULL,
    "experienceCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DevelopmentSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DevelopmentDimension" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "dimension" "SnapshotDimension" NOT NULL,
    "status" "SupportStatus" NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "signalIds" TEXT[],
    "evidenceIds" TEXT[],

    CONSTRAINT "DevelopmentDimension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuggestedAction" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT,
    "audience" "ActionAudience" NOT NULL,
    "source" "ActionSource" NOT NULL,
    "type" "ActionType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "curriculumItemId" TEXT,
    "activityId" TEXT,
    "inferenceId" TEXT,
    "interventionId" TEXT,
    "runId" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'OPEN',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuggestedAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "experienceId" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "contrastWithDeclared" TEXT,
    "inferenceIds" TEXT[],
    "evidenceIds" TEXT[],
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageEvent" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "studentId" TEXT,
    "courseId" TEXT,
    "runId" TEXT,
    "operation" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "estimatedCostUsd" DECIMAL(12,6),
    "latencyMs" INTEGER NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductEvent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "userId" TEXT,
    "courseId" TEXT,
    "studentId" TEXT,
    "dedupeKey" TEXT,
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_joinCode_key" ON "Course"("joinCode");

-- CreateIndex
CREATE INDEX "Course_teacherId_idx" ON "Course"("teacherId");

-- CreateIndex
CREATE INDEX "Enrollment_studentId_idx" ON "Enrollment"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Enrollment_courseId_studentId_key" ON "Enrollment"("courseId", "studentId");

-- CreateIndex
CREATE INDEX "CourseInvite_email_idx" ON "CourseInvite"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CourseInvite_courseId_email_key" ON "CourseInvite"("courseId", "email");

-- CreateIndex
CREATE INDEX "CurriculumItem_courseId_status_idx" ON "CurriculumItem"("courseId", "status");

-- CreateIndex
CREATE INDEX "Experience_studentId_courseId_idx" ON "Experience"("studentId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "AIConversation_experienceId_key" ON "AIConversation"("experienceId");

-- CreateIndex
CREATE INDEX "AIConversation_studentId_courseId_idx" ON "AIConversation"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_courseId_status_idx" ON "Activity"("courseId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_experienceId_key" ON "Submission"("experienceId");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_activityId_studentId_attempt_key" ON "Submission"("activityId", "studentId", "attempt");

-- CreateIndex
CREATE INDEX "InterpretationRun_studentId_courseId_createdAt_idx" ON "InterpretationRun"("studentId", "courseId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceObject_studentId_courseId_occurredAt_idx" ON "EvidenceObject"("studentId", "courseId", "occurredAt");

-- CreateIndex
CREATE INDEX "Signal_studentId_courseId_idx" ON "Signal"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "Signal_courseId_curriculumItemId_idx" ON "Signal"("courseId", "curriculumItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Inference_supersedesId_key" ON "Inference"("supersedesId");

-- CreateIndex
CREATE INDEX "Inference_courseId_state_reviewStatus_idx" ON "Inference"("courseId", "state", "reviewStatus");

-- CreateIndex
CREATE INDEX "Inference_studentId_courseId_idx" ON "Inference"("studentId", "courseId");

-- CreateIndex
CREATE INDEX "InferenceSupport_evidenceId_idx" ON "InferenceSupport"("evidenceId");

-- CreateIndex
CREATE UNIQUE INDEX "InferenceSupport_inferenceId_signalId_key" ON "InferenceSupport"("inferenceId", "signalId");

-- CreateIndex
CREATE INDEX "TeacherReview_inferenceId_idx" ON "TeacherReview"("inferenceId");

-- CreateIndex
CREATE INDEX "StudentResponse_inferenceId_idx" ON "StudentResponse"("inferenceId");

-- CreateIndex
CREATE INDEX "Intervention_courseId_occurredAt_idx" ON "Intervention"("courseId", "occurredAt");

-- CreateIndex
CREATE INDEX "DevelopmentSnapshot_studentId_courseId_createdAt_idx" ON "DevelopmentSnapshot"("studentId", "courseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DevelopmentDimension_snapshotId_dimension_key" ON "DevelopmentDimension"("snapshotId", "dimension");

-- CreateIndex
CREATE INDEX "SuggestedAction_studentId_courseId_status_idx" ON "SuggestedAction"("studentId", "courseId", "status");

-- CreateIndex
CREATE INDEX "SuggestedAction_courseId_audience_status_idx" ON "SuggestedAction"("courseId", "audience", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Feedback_runId_key" ON "Feedback"("runId");

-- CreateIndex
CREATE INDEX "Feedback_studentId_courseId_createdAt_idx" ON "Feedback"("studentId", "courseId", "createdAt");

-- CreateIndex
CREATE INDEX "AIUsageEvent_createdAt_idx" ON "AIUsageEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AIUsageEvent_studentId_createdAt_idx" ON "AIUsageEvent"("studentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProductEvent_dedupeKey_key" ON "ProductEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "ProductEvent_name_createdAt_idx" ON "ProductEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "ProductEvent_courseId_name_idx" ON "ProductEvent"("courseId", "name");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentProfile" ADD CONSTRAINT "StudentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherProfile" ADD CONSTRAINT "TeacherProfile_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Enrollment" ADD CONSTRAINT "Enrollment_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseInvite" ADD CONSTRAINT "CourseInvite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItem" ADD CONSTRAINT "CurriculumItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CurriculumItem" ADD CONSTRAINT "CurriculumItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CurriculumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Experience" ADD CONSTRAINT "Experience_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIConversation" ADD CONSTRAINT "AIConversation_focusItemId_fkey" FOREIGN KEY ("focusItemId") REFERENCES "CurriculumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AIConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCurriculumItem" ADD CONSTRAINT "ActivityCurriculumItem_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityCurriculumItem" ADD CONSTRAINT "ActivityCurriculumItem_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpretationRun" ADD CONSTRAINT "InterpretationRun_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpretationRun" ADD CONSTRAINT "InterpretationRun_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterpretationRun" ADD CONSTRAINT "InterpretationRun_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObject" ADD CONSTRAINT "EvidenceObject_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObject" ADD CONSTRAINT "EvidenceObject_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObject" ADD CONSTRAINT "EvidenceObject_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceObject" ADD CONSTRAINT "EvidenceObject_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceCurriculumItem" ADD CONSTRAINT "EvidenceCurriculumItem_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceCurriculumItem" ADD CONSTRAINT "EvidenceCurriculumItem_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signal" ADD CONSTRAINT "Signal_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inference" ADD CONSTRAINT "Inference_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inference" ADD CONSTRAINT "Inference_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inference" ADD CONSTRAINT "Inference_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inference" ADD CONSTRAINT "Inference_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inference" ADD CONSTRAINT "Inference_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "Inference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InferenceSupport" ADD CONSTRAINT "InferenceSupport_inferenceId_fkey" FOREIGN KEY ("inferenceId") REFERENCES "Inference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InferenceSupport" ADD CONSTRAINT "InferenceSupport_signalId_fkey" FOREIGN KEY ("signalId") REFERENCES "Signal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InferenceSupport" ADD CONSTRAINT "InferenceSupport_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "CurriculumItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationEvidence" ADD CONSTRAINT "EvaluationEvidence_evaluationId_fkey" FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvaluationEvidence" ADD CONSTRAINT "EvaluationEvidence_evidenceId_fkey" FOREIGN KEY ("evidenceId") REFERENCES "EvidenceObject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_inferenceId_fkey" FOREIGN KEY ("inferenceId") REFERENCES "Inference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherReview" ADD CONSTRAINT "TeacherReview_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResponse" ADD CONSTRAINT "StudentResponse_inferenceId_fkey" FOREIGN KEY ("inferenceId") REFERENCES "Inference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudentResponse" ADD CONSTRAINT "StudentResponse_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_inferenceId_fkey" FOREIGN KEY ("inferenceId") REFERENCES "Inference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Intervention" ADD CONSTRAINT "Intervention_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionTarget" ADD CONSTRAINT "InterventionTarget_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterventionTarget" ADD CONSTRAINT "InterventionTarget_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentSnapshot" ADD CONSTRAINT "DevelopmentSnapshot_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentSnapshot" ADD CONSTRAINT "DevelopmentSnapshot_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentSnapshot" ADD CONSTRAINT "DevelopmentSnapshot_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DevelopmentDimension" ADD CONSTRAINT "DevelopmentDimension_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "DevelopmentSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_curriculumItemId_fkey" FOREIGN KEY ("curriculumItemId") REFERENCES "CurriculumItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_inferenceId_fkey" FOREIGN KEY ("inferenceId") REFERENCES "Inference"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_interventionId_fkey" FOREIGN KEY ("interventionId") REFERENCES "Intervention"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuggestedAction" ADD CONSTRAINT "SuggestedAction_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_experienceId_fkey" FOREIGN KEY ("experienceId") REFERENCES "Experience"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageEvent" ADD CONSTRAINT "AIUsageEvent_runId_fkey" FOREIGN KEY ("runId") REFERENCES "InterpretationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductEvent" ADD CONSTRAINT "ProductEvent_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
