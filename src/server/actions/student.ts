"use server";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { parseActivityPrompts } from "@/domain/activity";
import { CURRENT_COURSE_COOKIE } from "@/lib/constants";
import { fieldErrorsFrom, optionalText, text, type ActionState } from "@/lib/forms";
import { requireEnrolledStudent, requireStudent } from "@/server/auth/guards";
import { destroySession } from "@/server/auth/session";
import { db } from "@/server/db";
import { queueInterpretation, retryInterpretation } from "@/server/engine/trigger";
import { EVENT, track } from "@/server/events";
import { deleteExperienceCascade } from "@/server/services/privacy";

const CONSENT_VERSION = "2026-10";

const declaredField = z.string().max(1500, "Máximo 1500 caracteres.").optional();

const contextSchema = z.object({
  currentContext: z.string().min(3, "Contanos brevemente en qué estás hoy.").max(1500),
  interests: declaredField,
  goals: z.string().min(3, "Contanos al menos un objetivo.").max(1500),
  strengths: declaredField,
  difficulties: declaredField,
  workPreferences: declaredField,
});

function readContext(formData: FormData) {
  return {
    currentContext: text(formData, "currentContext"),
    interests: text(formData, "interests") || undefined,
    goals: text(formData, "goals"),
    strengths: text(formData, "strengths") || undefined,
    difficulties: text(formData, "difficulties") || undefined,
    workPreferences: text(formData, "workPreferences") || undefined,
  };
}

function contextData(v: z.infer<typeof contextSchema>) {
  return {
    declaredCurrentContext: v.currentContext,
    declaredInterests: v.interests ?? null,
    declaredGoals: v.goals,
    declaredStrengths: v.strengths ?? null,
    declaredDifficulties: v.difficulties ?? null,
    declaredWorkPreferences: v.workPreferences ?? null,
    declaredUpdatedAt: new Date(),
  };
}

async function setCurrentCourse(courseId: string) {
  (await cookies()).set(CURRENT_COURSE_COOKIE, courseId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
}

async function enrollWithCode(studentId: string, rawCode: string): Promise<{ courseId: string } | { error: string }> {
  const code = rawCode.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) return { error: "El código tiene 6 caracteres (letras y números)." };
  const course = await db.course.findUnique({ where: { joinCode: code } });
  if (!course) return { error: "No encontramos una materia con ese código." };
  await db.enrollment.upsert({
    where: { courseId_studentId: { courseId: course.id, studentId } },
    create: { courseId: course.id, studentId },
    update: { status: "ACTIVE" },
  });
  return { courseId: course.id };
}

export async function completeOnboardingAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user } = await requireStudent({ allowIncompleteOnboarding: true });
  const parsed = contextSchema.safeParse(readContext(formData));
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const consent = formData.get("consent") === "on";
  const shareContext = formData.get("shareContext") === "on";

  let courseId: string | null = null;
  const joinCode = text(formData, "joinCode");
  if (joinCode) {
    const result = await enrollWithCode(user.id, joinCode);
    if ("error" in result) return { error: result.error, fieldErrors: { joinCode: result.error } };
    courseId = result.courseId;
  }

  await db.studentProfile.update({
    where: { userId: user.id },
    data: {
      ...contextData(parsed.data),
      consentAnalysisAt: consent ? new Date() : null,
      consentVersion: consent ? CONSENT_VERSION : null,
      shareContextWithTeachers: shareContext,
      onboardingCompletedAt: new Date(),
    },
  });
  await track(EVENT.studentOnboardingCompleted, {
    userId: user.id,
    studentId: user.id,
    courseId,
    dedupeKey: `onboarding:${user.id}`,
    properties: { consent, shareContext },
  });
  if (courseId) await setCurrentCourse(courseId);
  redirect("/s");
}

export async function updateContextAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user } = await requireStudent();
  const parsed = contextSchema.safeParse(readContext(formData));
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  await db.studentProfile.update({ where: { userId: user.id }, data: contextData(parsed.data) });
  refresh();
  return { ok: true, message: "Contexto actualizado." };
}

export async function updatePrivacyAction(formData: FormData): Promise<void> {
  const { user, profile } = await requireStudent();
  const consent = formData.get("consent") === "on";
  const shareContext = formData.get("shareContext") === "on";
  await db.studentProfile.update({
    where: { userId: user.id },
    data: {
      shareContextWithTeachers: shareContext,
      consentAnalysisAt: consent ? (profile.consentAnalysisAt ?? new Date()) : null,
      consentVersion: consent ? CONSENT_VERSION : null,
    },
  });
  refresh();
}

export async function joinCourseAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user } = await requireStudent();
  const result = await enrollWithCode(user.id, text(formData, "joinCode"));
  if ("error" in result) return { error: result.error, fieldErrors: { joinCode: result.error } };
  await setCurrentCourse(result.courseId);
  redirect(`/s/courses/${result.courseId}`);
}

export async function acceptInviteAction(inviteId: string): Promise<void> {
  const { user } = await requireStudent();
  const invite = await db.courseInvite.findFirst({ where: { id: inviteId, email: user.email, acceptedAt: null } });
  if (!invite) notFound();
  await db.$transaction([
    db.enrollment.upsert({
      where: { courseId_studentId: { courseId: invite.courseId, studentId: user.id } },
      create: { courseId: invite.courseId, studentId: user.id },
      update: { status: "ACTIVE" },
    }),
    db.courseInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
  ]);
  await setCurrentCourse(invite.courseId);
  redirect(`/s/courses/${invite.courseId}`);
}

export async function selectCourseAction(courseId: string): Promise<void> {
  await requireEnrolledStudent(courseId);
  await setCurrentCourse(courseId);
  redirect("/s");
}

// ───────────── Tutor ─────────────

export async function startConversationAction(formData: FormData): Promise<void> {
  const courseId = text(formData, "courseId");
  const { user } = await requireEnrolledStudent(courseId);
  const focusItemId = optionalText(formData, "focusItemId");
  const activityId = optionalText(formData, "activityId");
  const suggestedActionId = optionalText(formData, "suggestedActionId");

  const [focusItem, activity, action] = await Promise.all([
    focusItemId ? db.curriculumItem.findFirst({ where: { id: focusItemId, courseId, status: "ACCEPTED" } }) : null,
    activityId ? db.activity.findFirst({ where: { id: activityId, courseId, status: "PUBLISHED" } }) : null,
    suggestedActionId
      ? db.suggestedAction.findFirst({ where: { id: suggestedActionId, courseId, studentId: user.id, status: "OPEN" } })
      : null,
  ]);
  const title = activity ? `Sobre la actividad: ${activity.title}` : focusItem ? focusItem.title : "Sesión de estudio";

  const experience = await db.experience.create({
    data: {
      courseId,
      studentId: user.id,
      type: "AI_CONVERSATION",
      title,
      activityId: activity?.id ?? null,
      conversation: {
        create: {
          courseId,
          studentId: user.id,
          title,
          focusItemId: focusItem?.id ?? null,
          activityId: activity?.id ?? null,
          suggestedActionId: action?.id ?? null,
        },
      },
    },
    include: { conversation: true },
  });
  redirect(`/s/courses/${courseId}/tutor/${experience.conversation!.id}`);
}

export async function closeConversationAction(conversationId: string): Promise<void> {
  const { user } = await requireStudent();
  const conversation = await db.aIConversation.findFirst({ where: { id: conversationId, studentId: user.id, status: "ACTIVE" } });
  if (!conversation) notFound();
  await requireEnrolledStudent(conversation.courseId);
  const closedAt = new Date();
  await db.$transaction([
    db.aIConversation.update({ where: { id: conversation.id }, data: { status: "CLOSED", closedAt } }),
    db.experience.update({ where: { id: conversation.experienceId }, data: { completedAt: closedAt } }),
  ]);
  await queueInterpretation({
    experienceId: conversation.experienceId,
    courseId: conversation.courseId,
    studentId: user.id,
    source: "AI_CONVERSATION",
  });
  refresh();
}

export async function retryRunAction(runId: string): Promise<void> {
  const { user } = await requireStudent();
  await retryInterpretation(runId, user.id);
  refresh();
}

export async function deleteConversationAction(conversationId: string): Promise<void> {
  const { user } = await requireStudent();
  const conversation = await db.aIConversation.findFirst({ where: { id: conversationId, studentId: user.id } });
  if (!conversation) notFound();
  await deleteExperienceCascade(conversation.experienceId, user.id, conversation.courseId);
  redirect(`/s/courses/${conversation.courseId}`);
}

// ───────────── Actividades ─────────────

const submissionMetaSchema = z.object({
  declaredAssistance: z.enum(["NONE", "TUTOR_ONLY", "EXTERNAL_AI_PARTIAL", "EXTERNAL_AI_EXTENSIVE", "PEER_OR_OTHER"]).nullable(),
  assistanceNote: z.string().max(1000).nullable(),
  confidence: z.enum(["LOW", "MEDIUM", "HIGH"]).nullable(),
});

export async function saveSubmissionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user } = await requireStudent();
  const activityId = text(formData, "activityId");
  const intent = text(formData, "intent") === "submit" ? "submit" : "draft";
  const activity = await db.activity.findFirst({
    where: { id: activityId, status: "PUBLISHED", course: { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } } },
  });
  if (!activity) return { error: "La actividad no está disponible." };

  const prompts = parseActivityPrompts(activity.prompts);
  const answers: Record<string, string> = {};
  const fieldErrors: Record<string, string> = {};
  for (const p of prompts) {
    const value = text(formData, `answer_${p.key}`);
    if (value.length > 8000) fieldErrors[`answer_${p.key}`] = "Máximo 8000 caracteres.";
    if (intent === "submit" && value.length === 0) fieldErrors[`answer_${p.key}`] = "Respondé esta consigna antes de entregar.";
    answers[p.key] = value;
  }
  const meta = submissionMetaSchema.safeParse({
    declaredAssistance: optionalText(formData, "declaredAssistance"),
    assistanceNote: optionalText(formData, "assistanceNote"),
    confidence: optionalText(formData, "confidence"),
  });
  if (!meta.success) Object.assign(fieldErrors, fieldErrorsFrom(meta.error));
  if (intent === "submit" && meta.success && !meta.data.declaredAssistance) {
    fieldErrors.declaredAssistance = "Indicá si usaste ayuda: es parte del contexto de la evidencia.";
  }
  if (Object.keys(fieldErrors).length > 0 || !meta.success) {
    return { error: "Revisá los campos marcados.", fieldErrors };
  }

  const draft = await db.submission.findFirst({
    where: { activityId, studentId: user.id, status: "DRAFT" },
    orderBy: { attempt: "desc" },
  });
  const submittedAt = intent === "submit" ? new Date() : null;
  let submission;
  if (draft) {
    submission = await db.submission.update({
      where: { id: draft.id },
      data: { answers, ...meta.data, status: intent === "submit" ? "SUBMITTED" : "DRAFT", submittedAt },
    });
  } else {
    const last = await db.submission.findFirst({ where: { activityId, studentId: user.id }, orderBy: { attempt: "desc" } });
    const experience = await db.experience.create({
      data: { courseId: activity.courseId, studentId: user.id, type: "CHALLENGE", title: activity.title, activityId },
    });
    submission = await db.submission.create({
      data: {
        activityId,
        studentId: user.id,
        experienceId: experience.id,
        attempt: (last?.attempt ?? 0) + 1,
        answers,
        ...meta.data,
        status: intent === "submit" ? "SUBMITTED" : "DRAFT",
        submittedAt,
      },
    });
  }

  if (intent === "submit") {
    await db.experience.update({ where: { id: submission.experienceId }, data: { completedAt: submittedAt } });
    await queueInterpretation({
      experienceId: submission.experienceId,
      courseId: activity.courseId,
      studentId: user.id,
      source: "CHALLENGE_SUBMISSION",
    });
    refresh();
    return { ok: true, message: "Entrega enviada. Educai está analizando la evidencia." };
  }
  refresh();
  return { ok: true, message: "Borrador guardado." };
}

export async function startNewAttemptAction(activityId: string): Promise<void> {
  const { user } = await requireStudent();
  const activity = await db.activity.findFirst({
    where: { id: activityId, status: "PUBLISHED", course: { enrollments: { some: { studentId: user.id, status: "ACTIVE" } } } },
  });
  if (!activity) notFound();
  const existingDraft = await db.submission.findFirst({ where: { activityId, studentId: user.id, status: "DRAFT" } });
  if (!existingDraft) {
    const last = await db.submission.findFirst({ where: { activityId, studentId: user.id }, orderBy: { attempt: "desc" } });
    const experience = await db.experience.create({
      data: { courseId: activity.courseId, studentId: user.id, type: "CHALLENGE", title: activity.title, activityId },
    });
    await db.submission.create({
      data: { activityId, studentId: user.id, experienceId: experience.id, attempt: (last?.attempt ?? 0) + 1, answers: {} },
    });
  }
  refresh();
}

// ───────────── Próximos pasos e inferencias ─────────────

export async function setSuggestedActionStatusAction(actionId: string, status: "DONE" | "DISMISSED"): Promise<void> {
  const { user } = await requireStudent();
  const next = z.enum(["DONE", "DISMISSED"]).parse(status);
  const updated = await db.suggestedAction.updateMany({
    where: { id: actionId, studentId: user.id, audience: "STUDENT", status: "OPEN" },
    data: { status: next, completedAt: new Date() },
  });
  if (updated.count > 0 && next === "DONE") {
    const action = await db.suggestedAction.findUnique({ where: { id: actionId }, select: { courseId: true } });
    await track(EVENT.studentNextStepCompleted, {
      userId: user.id,
      studentId: user.id,
      courseId: action?.courseId,
      properties: { via: "manual", actionId },
    });
  }
  refresh();
}

const responseSchema = z.object({
  inferenceId: z.string().min(1),
  stance: z.enum(["AGREE", "DISAGREE", "MISSING_CONTEXT"]),
  note: z.string().max(1500).nullable(),
});

export async function respondToInferenceAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user } = await requireStudent();
  const parsed = responseSchema.safeParse({
    inferenceId: text(formData, "inferenceId"),
    stance: text(formData, "stance"),
    note: optionalText(formData, "note"),
  });
  if (!parsed.success) return { error: "Elegí una opción.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const inference = await db.inference.findFirst({
    where: { id: parsed.data.inferenceId, studentId: user.id, reviewStatus: { not: "INCORRECT" } },
  });
  if (!inference) return { error: "No encontramos esa conclusión." };
  await db.studentResponse.create({
    data: { inferenceId: inference.id, studentId: user.id, stance: parsed.data.stance, note: parsed.data.note },
  });
  refresh();
  return { ok: true, message: "Gracias. Tu docente va a ver tu respuesta junto a esta conclusión." };
}

// ───────────── Cuenta ─────────────

export async function deleteAccountAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user } = await requireStudent();
  if (text(formData, "confirmEmail").toLowerCase() !== user.email) {
    return { error: "Escribí tu email exactamente para confirmar.", fieldErrors: { confirmEmail: "No coincide." } };
  }
  await db.$transaction([
    db.productEvent.deleteMany({ where: { OR: [{ userId: user.id }, { studentId: user.id }] } }),
    db.user.delete({ where: { id: user.id } }),
  ]);
  await destroySession();
  redirect("/login?deleted=1");
}
