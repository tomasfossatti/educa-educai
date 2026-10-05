import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";

/**
 * Eventos de producto para medir activación, engagement, calidad y cierre del loop.
 * Los eventos "primera vez" usan dedupeKey para registrarse una sola vez.
 */
export const EVENT = {
  studentOnboardingCompleted: "student.onboarding_completed",
  studentFirstEvidence: "student.first_evidence",
  studentFeedbackViewed: "student.feedback_viewed",
  studentActiveDay: "student.active_day",
  studentNextStepCompleted: "student.next_step_completed",
  teacherCurriculumConfigured: "teacher.curriculum_configured",
  teacherActivityAnalyzed: "teacher.activity_first_analyzed",
  teacherInsightOpened: "teacher.insight_opened",
  teacherInferenceReviewed: "teacher.inference_reviewed",
  teacherInterventionCreated: "teacher.intervention_created",
  loopInsightToAction: "loop.insight_to_action",
  loopActionToEvidence: "loop.action_to_evidence",
  engineRunFinished: "engine.run_finished",
} as const;

export type EventName = (typeof EVENT)[keyof typeof EVENT];

export async function track(
  name: EventName,
  data: {
    userId?: string | null;
    courseId?: string | null;
    studentId?: string | null;
    dedupeKey?: string;
    properties?: Prisma.InputJsonValue;
  } = {},
): Promise<void> {
  try {
    await db.productEvent.createMany({
      data: [
        {
          name,
          userId: data.userId ?? null,
          courseId: data.courseId ?? null,
          studentId: data.studentId ?? null,
          dedupeKey: data.dedupeKey ?? null,
          properties: data.properties,
        },
      ],
      skipDuplicates: true,
    });
  } catch (error) {
    console.error(`[events] no se pudo registrar ${name}`, error);
  }
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
