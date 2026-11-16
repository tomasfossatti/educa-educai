/**
 * Datos sintéticos para los flujos de punta a punta: cada test crea su propio docente, cátedra y
 * estudiantes, con emails únicos y contraseñas aleatorias que solo viven en memoria.
 */
import { randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import type { Page } from "@playwright/test";
import { hashPassword } from "../../src/server/auth/password";

export const db = new PrismaClient({ datasources: { db: { url: process.env.E2E_DATABASE_URL } } });

const uid = () => randomBytes(4).toString("hex");

export interface Person {
  id: string;
  email: string;
  password: string;
}

async function person(role: "TEACHER" | "STUDENT", extra: object, name: string): Promise<Person> {
  const password = randomBytes(18).toString("base64url");
  const email = `e2e-${role.toLowerCase()}-${uid()}@test.educai`;
  const user = await db.user.create({ data: { email, name, passwordHash: await hashPassword(password), role, ...extra } });
  return { id: user.id, email, password };
}

/** Una cátedra con temas aprobados, su docente y estudiantes inscriptos con consentimiento. */
export async function world(opts: { students?: number; topics?: string[] } = {}) {
  const institution = await db.institution.create({ data: { name: `Universidad E2E ${uid()}` } });
  const teacher = await person("TEACHER", { teacherProfile: { create: { institutionId: institution.id } } }, "Docente E2E");
  const course = await db.course.create({
    data: { institutionId: institution.id, teacherId: teacher.id, name: `Estrategia E2E ${uid()}`, joinCode: uid().slice(0, 6).toUpperCase(), curriculumStatus: "CONFIGURED" },
  });
  const topics = [];
  for (const [position, title] of (opts.topics ?? ["Hipotesis falsables", "Segmentacion de mercado"]).entries()) {
    topics.push(await db.curriculumItem.create({ data: { courseId: course.id, kind: "CONCEPT", title, origin: "TEACHER", status: "ACCEPTED", position } }));
  }
  const students: Person[] = [];
  for (let i = 0; i < (opts.students ?? 1); i++) {
    const s = await person(
      "STUDENT",
      { studentProfile: { create: { consentAnalysisAt: new Date(), consentVersion: "2026-11", onboardingCompletedAt: new Date(), career: "Administración", projectDescription: "Viandas" } } },
      `Estudiante E2E ${i + 1}`,
    );
    await db.enrollment.create({ data: { courseId: course.id, studentId: s.id } });
    students.push(s);
  }
  return { teacher, course, topics, students };
}

export async function login(page: Page, who: Person) {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.fill("input[name=email]", who.email);
  await page.fill("input[name=password]", who.password);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.waitForLoadState("networkidle");
}

/**
 * Carpeta de la materia de un estudiante. `world()` inscribe directo en la base, así que la carpeta la
 * crea el panel al abrir el inicio (mientras se transmite la página): se espera a que exista.
 */
export async function subjectFolder(studentId: string, courseId: string) {
  for (let i = 0; i < 50; i++) {
    const folder = await db.folder.findFirst({ where: { studentId, courseId, kind: "SUBJECT" } });
    if (folder) return folder;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("La carpeta de la materia no se creó al entrar al panel.");
}

/** Dirección de la carpeta de la materia de un estudiante. */
export async function subjectFolderUrl(studentId: string, courseId: string): Promise<string> {
  return `/s/folders/${(await subjectFolder(studentId, courseId)).id}`;
}

/** Pregunta desde el inicio, que es el chat de la materia actual, y espera ver la pregunta. */
export async function askFromHome(page: Page, question: string) {
  await page.goto("/s");
  await page.waitForLoadState("networkidle");
  await page.getByRole("textbox", { name: "Tu pregunta" }).fill(question);
  await page.getByRole("button", { name: "Preguntar", exact: true }).click();
}
