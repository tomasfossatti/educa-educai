"use server";

import { randomInt } from "node:crypto";
import type { ActionType, ReviewStatus } from "@prisma/client";
import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { activityPromptsSchema } from "@/domain/activity";
import { fieldErrorsFrom, optionalText, text, type ActionState } from "@/lib/forms";
import { isAIConfigured } from "@/server/ai";
import { requireCourseTeacher, requireTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { computeAndStoreSnapshot } from "@/server/engine/snapshot";
import { EVENT, track } from "@/server/events";
import { startCurriculumExtraction } from "@/server/services/curriculum";

const JOIN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateJoinCode(): string {
  return Array.from({ length: 6 }, () => JOIN_ALPHABET[randomInt(JOIN_ALPHABET.length)]).join("");
}

// ───────────── Materia ─────────────

const courseSchema = z.object({
  name: z.string().min(3, "Ingresá el nombre de la materia.").max(160),
  description: z.string().max(1000).nullable(),
});

export async function createCourseAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user, profile } = await requireTeacher();
  const parsed = courseSchema.safeParse({ name: text(formData, "name"), description: optionalText(formData, "description") });
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };

  let courseId: string | null = null;
  for (let attempt = 0; attempt < 5 && !courseId; attempt++) {
    const joinCode = generateJoinCode();
    if (await db.course.findUnique({ where: { joinCode } })) continue;
    const course = await db.course.create({
      data: { ...parsed.data, joinCode, teacherId: user.id, institutionId: profile.institutionId },
    });
    courseId = course.id;
  }
  if (!courseId) return { error: "No se pudo generar un código de materia. Intentá de nuevo." };
  redirect(`/t/courses/${courseId}/curriculum`);
}

// ───────────── Currícula ─────────────

const MAX_PDF_BYTES = 8 * 1024 * 1024;

export async function startExtractionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const courseId = text(formData, "courseId");
  const { user } = await requireCourseTeacher(courseId);
  if (!isAIConfigured()) return { error: "El servicio de IA no está configurado en el servidor. Podés cargar los ítems manualmente." };

  let programText = text(formData, "programText") || null;
  let pdf: { name: string; base64: string } | null = null;
  const file = formData.get("programFile");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_PDF_BYTES) return { error: "El archivo supera 8 MB.", fieldErrors: { programFile: "Máximo 8 MB." } };
    const name = file.name.toLowerCase();
    if (file.type === "application/pdf" || name.endsWith(".pdf")) {
      pdf = { name: file.name, base64: Buffer.from(await file.arrayBuffer()).toString("base64") };
    } else if (name.endsWith(".txt") || name.endsWith(".md") || file.type.startsWith("text/")) {
      programText = (await file.text()).trim();
    } else {
      return { error: "Formato no soportado. Usá PDF, TXT o MD, o pegá el texto.", fieldErrors: { programFile: "Formato no soportado." } };
    }
  }
  if (!pdf && (!programText || programText.length < 200)) {
    return { error: "Pegá el programa completo (al menos 200 caracteres) o subí un archivo.", fieldErrors: { programText: "Texto muy breve." } };
  }
  if (programText && programText.length > 60_000) {
    return { error: "El programa es demasiado largo (máximo 60.000 caracteres).", fieldErrors: { programText: "Demasiado largo." } };
  }
  await startCurriculumExtraction({ courseId, teacherId: user.id, programText: pdf ? null : programText, pdf });
  refresh();
  return { ok: true };
}

async function ownedItem(itemId: string) {
  const { user } = await requireTeacher();
  const item = await db.curriculumItem.findFirst({ where: { id: itemId, course: { teacherId: user.id } } });
  if (!item) notFound();
  return item;
}

const itemStatusSchema = z.enum(["ACCEPTED", "ARCHIVED", "PROPOSED"]);

export async function setCurriculumItemStatusAction(itemId: string, status: "ACCEPTED" | "ARCHIVED" | "PROPOSED"): Promise<void> {
  const item = await ownedItem(itemId);
  await db.curriculumItem.update({ where: { id: item.id }, data: { status: itemStatusSchema.parse(status) } });
  refresh();
}

export async function acceptAllProposedAction(courseId: string): Promise<void> {
  await requireCourseTeacher(courseId);
  await db.curriculumItem.updateMany({ where: { courseId, status: "PROPOSED" }, data: { status: "ACCEPTED" } });
  refresh();
}

const itemSchema = z.object({
  kind: z.enum(["CONCEPT", "OBJECTIVE", "COMPETENCY", "CRITERION"]),
  title: z.string().min(2, "Ingresá un título.").max(200),
  description: z.string().max(1500).nullable(),
  parentId: z.string().nullable(),
});

function readItem(formData: FormData) {
  return {
    kind: text(formData, "kind"),
    title: text(formData, "title"),
    description: optionalText(formData, "description"),
    parentId: optionalText(formData, "parentId"),
  };
}

export async function saveCurriculumItemAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const courseId = text(formData, "courseId");
  await requireCourseTeacher(courseId);
  const parsed = itemSchema.safeParse(readItem(formData));
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  if (parsed.data.parentId) {
    const parent = await db.curriculumItem.findFirst({ where: { id: parsed.data.parentId, courseId } });
    if (!parent) return { error: "El ítem relacionado no existe." };
  }
  const itemId = optionalText(formData, "itemId");
  if (itemId) {
    const item = await db.curriculumItem.findFirst({ where: { id: itemId, courseId } });
    if (!item) return { error: "El ítem no existe." };
    await db.curriculumItem.update({ where: { id: item.id }, data: parsed.data });
  } else {
    const position = await db.curriculumItem.count({ where: { courseId } });
    await db.curriculumItem.create({
      data: { ...parsed.data, courseId, origin: "TEACHER", status: "ACCEPTED", position },
    });
  }
  refresh();
  return { ok: true, message: itemId ? "Ítem actualizado." : "Ítem agregado." };
}

export async function confirmCurriculumAction(courseId: string): Promise<void> {
  const { user, course } = await requireCourseTeacher(courseId);
  const accepted = await db.curriculumItem.count({ where: { courseId, status: "ACCEPTED" } });
  if (accepted === 0) return;
  await db.course.update({
    where: { id: courseId },
    data: { curriculumStatus: "CONFIGURED", curriculumConfirmedAt: course.curriculumConfirmedAt ?? new Date() },
  });
  await track(EVENT.teacherCurriculumConfigured, {
    userId: user.id,
    courseId,
    dedupeKey: `curriculum_configured:${courseId}`,
    properties: { items: accepted },
  });
  redirect(`/t/courses/${courseId}`);
}

// ───────────── Actividades ─────────────

const activitySchema = z.object({
  title: z.string().min(3, "Ingresá un título.").max(200),
  kind: z.enum(["BASELINE", "CHALLENGE", "PRACTICE"]),
  scenario: z.string().min(20, "Describí la situación o caso (al menos 20 caracteres).").max(4000),
  instructions: z.string().min(10, "Escribí la consigna general.").max(2000),
});

export async function saveActivityAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const courseId = text(formData, "courseId");
  await requireCourseTeacher(courseId);
  const intent = text(formData, "intent") === "publish" ? "publish" : "draft";
  const parsed = activitySchema.safeParse({
    title: text(formData, "title"),
    kind: text(formData, "kind"),
    scenario: text(formData, "scenario"),
    instructions: text(formData, "instructions"),
  });
  const prompts = Array.from({ length: 6 }, (_, i) => ({
    key: `p${i + 1}`,
    label: text(formData, `prompt_label_${i + 1}`),
    help: text(formData, `prompt_help_${i + 1}`),
  }))
    .filter((p) => p.label.length > 0)
    .map((p, i) => ({ ...p, key: `p${i + 1}` }));
  const promptsParsed = activityPromptsSchema.safeParse(prompts);
  const fieldErrors: Record<string, string> = parsed.success ? {} : fieldErrorsFrom(parsed.error);
  if (!promptsParsed.success) fieldErrors.prompts = "Agregá entre 1 y 6 consignas (mínimo 3 caracteres cada una).";
  if (!parsed.success || !promptsParsed.success) return { error: "Revisá los campos marcados.", fieldErrors };

  const itemIds = formData.getAll("items").filter((v): v is string => typeof v === "string");
  const validItems = await db.curriculumItem.findMany({
    where: { id: { in: itemIds }, courseId, status: "ACCEPTED" },
    select: { id: true },
  });

  const activityId = optionalText(formData, "activityId");
  if (activityId) {
    const activity = await db.activity.findFirst({
      where: { id: activityId, courseId },
      include: { _count: { select: { submissions: { where: { status: "SUBMITTED" } } } } },
    });
    if (!activity) return { error: "La actividad no existe." };
    const promptsChanged = JSON.stringify(activity.prompts) !== JSON.stringify(promptsParsed.data);
    if (activity._count.submissions > 0 && promptsChanged) {
      return { error: "Ya hay entregas: no se pueden cambiar las consignas (la evidencia quedaría desalineada). Creá una actividad nueva." };
    }
    await db.$transaction([
      db.activityCurriculumItem.deleteMany({ where: { activityId } }),
      db.activity.update({
        where: { id: activityId },
        data: {
          ...parsed.data,
          prompts: promptsParsed.data,
          ...(intent === "publish" && activity.status === "DRAFT" ? { status: "PUBLISHED", publishedAt: new Date() } : {}),
          curriculumLinks: { create: validItems.map((i) => ({ curriculumItemId: i.id })) },
        },
      }),
    ]);
    redirect(`/t/courses/${courseId}/activities/${activityId}`);
  }
  const created = await db.activity.create({
    data: {
      ...parsed.data,
      courseId,
      prompts: promptsParsed.data,
      status: intent === "publish" ? "PUBLISHED" : "DRAFT",
      publishedAt: intent === "publish" ? new Date() : null,
      curriculumLinks: { create: validItems.map((i) => ({ curriculumItemId: i.id })) },
    },
  });
  redirect(`/t/courses/${courseId}/activities/${created.id}`);
}

export async function setActivityStatusAction(activityId: string, status: "PUBLISHED" | "CLOSED"): Promise<void> {
  const { user } = await requireTeacher();
  const activity = await db.activity.findFirst({ where: { id: activityId, course: { teacherId: user.id } } });
  if (!activity) notFound();
  const next = z.enum(["PUBLISHED", "CLOSED"]).parse(status);
  await db.activity.update({
    where: { id: activity.id },
    data: { status: next, publishedAt: next === "PUBLISHED" ? (activity.publishedAt ?? new Date()) : activity.publishedAt },
  });
  refresh();
}

// ───────────── Estudiantes ─────────────

export async function inviteStudentsAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const courseId = text(formData, "courseId");
  await requireCourseTeacher(courseId);
  const emails = [...new Set(text(formData, "emails").split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const invalid = emails.filter((e) => !z.email().safeParse(e).success);
  if (emails.length === 0 || invalid.length > 0) {
    return { error: invalid.length ? `Emails inválidos: ${invalid.join(", ")}` : "Ingresá al menos un email.", fieldErrors: { emails: "Revisá la lista." } };
  }
  if (emails.length > 200) return { error: "Máximo 200 emails por vez." };
  await db.courseInvite.createMany({ data: emails.map((email) => ({ courseId, email })), skipDuplicates: true });
  refresh();
  return {
    ok: true,
    message: `${emails.length} ${emails.length === 1 ? "invitación registrada" : "invitaciones registradas"}. Cada estudiante la verá al iniciar sesión con ese email y decide si se une.`,
  };
}

export async function removeStudentAction(courseId: string, studentId: string): Promise<void> {
  await requireCourseTeacher(courseId);
  await db.enrollment.updateMany({ where: { courseId, studentId }, data: { status: "REMOVED" } });
  refresh();
}

// ───────────── Revisión docente ─────────────

const reviewSchema = z.object({
  inferenceId: z.string().min(1),
  verdict: z.enum(["CONFIRMED", "PARTIALLY_CORRECT", "INCORRECT", "NEEDS_CONTEXT"], { message: "Elegí una opción." }),
  comment: z.string().max(2000).nullable(),
});

export async function reviewInferenceAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const { user } = await requireTeacher();
  const parsed = reviewSchema.safeParse({
    inferenceId: text(formData, "inferenceId"),
    verdict: text(formData, "verdict"),
    comment: optionalText(formData, "comment"),
  });
  if (!parsed.success) return { error: "Elegí una opción de revisión.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const inference = await db.inference.findFirst({
    where: { id: parsed.data.inferenceId, course: { teacherId: user.id } },
  });
  if (!inference) return { error: "La inferencia no existe." };
  if ((parsed.data.verdict === "INCORRECT" || parsed.data.verdict === "NEEDS_CONTEXT") && !parsed.data.comment) {
    return {
      error: "Agregá un comentario: las correcciones son las que permiten calibrar a Educai.",
      fieldErrors: { comment: "Contá brevemente qué falta o por qué es incorrecta." },
    };
  }

  const previous: ReviewStatus = inference.reviewStatus;
  await db.$transaction([
    db.teacherReview.create({
      data: { inferenceId: inference.id, teacherId: user.id, verdict: parsed.data.verdict, comment: parsed.data.comment },
    }),
    db.inference.update({ where: { id: inference.id }, data: { reviewStatus: parsed.data.verdict } }),
  ]);
  if (previous === "INCORRECT" || parsed.data.verdict === "INCORRECT") {
    // Una corrección cambia qué señales cuentan para el snapshot del estudiante.
    await computeAndStoreSnapshot({ studentId: inference.studentId, courseId: inference.courseId });
  }
  await track(EVENT.teacherInferenceReviewed, {
    userId: user.id,
    courseId: inference.courseId,
    studentId: inference.studentId,
    properties: { inferenceId: inference.id, verdict: parsed.data.verdict, previous, supportStatus: inference.supportStatus },
  });
  refresh();
  return { ok: true, message: "Revisión guardada." };
}

// ───────────── Intervenciones ─────────────

const interventionSchema = z.object({
  courseId: z.string().min(1),
  type: z.enum(["EXPLAIN", "ASK", "REGROUP", "PRACTICE", "FEEDBACK", "NEW_CHALLENGE", "OTHER"]),
  description: z.string().min(5, "Describí qué vas a hacer o hiciste.").max(2000),
  messageToStudents: z.string().max(2000).nullable(),
  activityId: z.string().nullable(),
  inferenceId: z.string().nullable(),
  insightKey: z.string().max(200).nullable(),
  curriculumItemId: z.string().nullable(),
  occurredAt: z.coerce.date(),
  studentIds: z.array(z.string()).min(1, "Elegí al menos un estudiante."),
});

export async function createInterventionAction(_prev: ActionState | null, formData: FormData): Promise<ActionState> {
  const courseId = text(formData, "courseId");
  const { user } = await requireCourseTeacher(courseId);
  const parsed = interventionSchema.safeParse({
    courseId,
    type: text(formData, "type"),
    description: text(formData, "description"),
    messageToStudents: optionalText(formData, "messageToStudents"),
    activityId: optionalText(formData, "activityId"),
    inferenceId: optionalText(formData, "inferenceId"),
    insightKey: optionalText(formData, "insightKey"),
    curriculumItemId: optionalText(formData, "curriculumItemId"),
    occurredAt: text(formData, "occurredAt") || new Date().toISOString(),
    studentIds: formData.getAll("studentIds").filter((v): v is string => typeof v === "string"),
  });
  if (!parsed.success) return { error: "Revisá los campos marcados.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const data = parsed.data;

  const [enrolled, activity, inference, item] = await Promise.all([
    db.enrollment.findMany({ where: { courseId, status: "ACTIVE", studentId: { in: data.studentIds } }, select: { studentId: true } }),
    data.activityId ? db.activity.findFirst({ where: { id: data.activityId, courseId } }) : null,
    data.inferenceId ? db.inference.findFirst({ where: { id: data.inferenceId, courseId } }) : null,
    data.curriculumItemId ? db.curriculumItem.findFirst({ where: { id: data.curriculumItemId, courseId } }) : null,
  ]);
  if (enrolled.length === 0) return { error: "Los estudiantes elegidos no están en esta materia." };
  if (data.activityId && !activity) return { error: "La actividad no existe." };
  if (activity && activity.status === "DRAFT") return { error: "Publicá la actividad antes de proponerla a estudiantes." };
  const studentIds = enrolled.map((e) => e.studentId);
  const curriculumItemId = item?.id ?? inference?.curriculumItemId ?? null;
  const occurredAt = data.occurredAt > new Date() ? new Date() : data.occurredAt;

  const intervention = await db.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        courseId,
        teacherId: user.id,
        type: data.type,
        description: data.description,
        messageToStudents: data.messageToStudents,
        activityId: activity?.id ?? null,
        inferenceId: inference?.id ?? null,
        curriculumItemId,
        insightKey: data.insightKey ?? (inference ? `inference:${inference.id}` : null),
        occurredAt,
        targets: { create: studentIds.map((studentId) => ({ studentId })) },
      },
    });
    if (data.messageToStudents || activity) {
      const type: ActionType = activity ? "TRY_ACTIVITY" : "TEACHER_MESSAGE";
      await tx.suggestedAction.createMany({
        data: studentIds.map((studentId) => ({
          courseId,
          studentId,
          audience: "STUDENT" as const,
          source: "TEACHER" as const,
          type,
          title: activity ? `Tu docente te propone: ${activity.title}` : "Mensaje de tu docente",
          description: data.messageToStudents ?? "Tu docente te propone esta actividad.",
          activityId: activity?.id ?? null,
          curriculumItemId,
          interventionId: created.id,
        })),
      });
    }
    if (inference) {
      await tx.suggestedAction.updateMany({
        where: { inferenceId: inference.id, audience: "TEACHER", status: "OPEN" },
        data: { status: "DONE", completedAt: new Date() },
      });
    }
    return created;
  });

  await track(EVENT.teacherInterventionCreated, {
    userId: user.id,
    courseId,
    properties: { interventionId: intervention.id, type: data.type, students: studentIds.length },
  });
  if (intervention.insightKey) {
    await track(EVENT.loopInsightToAction, {
      userId: user.id,
      courseId,
      dedupeKey: `insight_to_action:${intervention.insightKey}`,
      properties: { key: intervention.insightKey, interventionId: intervention.id },
    });
  }
  refresh();
  return { ok: true, message: "Intervención registrada. Educai va a relacionar la evidencia nueva de estos estudiantes con esta intervención." };
}

export async function setTeacherActionStatusAction(actionId: string, status: "DONE" | "DISMISSED"): Promise<void> {
  const { user } = await requireTeacher();
  await db.suggestedAction.updateMany({
    where: { id: actionId, audience: "TEACHER", status: "OPEN", course: { teacherId: user.id } },
    data: { status: z.enum(["DONE", "DISMISSED"]).parse(status), completedAt: new Date() },
  });
  refresh();
}
