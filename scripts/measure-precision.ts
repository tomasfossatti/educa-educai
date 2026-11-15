/**
 * Mide la precisión de la detección de dudas (criterio de la etapa 4: al menos 80%).
 *
 * Corre el motor de interpretación real sobre las 30 conversaciones etiquetadas de
 * tests/fixtures/dudas/conversaciones.json, en una base de prueba, y compara los temas con
 * duda detectados contra las etiquetas. Escribe docs/informes/precision-etapa-4.md.
 *
 *   TEST_DATABASE_URL=… AI_PROVIDER=anthropic ANTHROPIC_API_KEY=… npm run eval:dudas
 *   TEST_DATABASE_URL=… npm run eval:dudas -- --dry-run     (proveedor guionado, sin gasto: solo prueba el circuito)
 *
 * Usa solo datos sintéticos. Corta si el costo acumulado supera PRECISION_MAX_USD (5 USD por defecto).
 */
import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const dryRun = process.argv.includes("--dry-run");
const TEST_DB = process.env.TEST_DATABASE_URL;
const MAX_USD = Number(process.env.PRECISION_MAX_USD ?? 5);
const TARGET = 0.8;

interface Fixture {
  course: { name: string; topics: string[] };
  conversations: { id: string; messages: { role: "STUDENT" | "TUTOR"; content: string }[]; expectedDoubts: string[] }[];
}

async function main() {
  if (!TEST_DB) throw new Error("Definí TEST_DATABASE_URL (una base de prueba, nunca la de producción).");
  process.env.DATABASE_URL = TEST_DB;
  if (dryRun) {
    process.env.AI_PROVIDER = "scripted";
  } else if (process.env.AI_PROVIDER !== "anthropic" || !(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) {
    throw new Error("Para medir con el modelo real: AI_PROVIDER=anthropic y ANTHROPIC_API_KEY. Para probar el circuito: --dry-run.");
  }

  const { db } = await import("@/server/db");
  const { runInterpretation } = await import("@/server/engine/pipeline");
  const fixture = JSON.parse(readFileSync("tests/fixtures/dudas/conversaciones.json", "utf8")) as Fixture;

  const tag = randomBytes(4).toString("hex");
  const institution = await db.institution.create({ data: { name: `Medición de precisión ${tag}` } });
  const teacher = await db.user.create({
    data: {
      email: `precision-docente-${tag}@test.educai`,
      name: "Docente sintético",
      passwordHash: randomBytes(24).toString("base64url"),
      role: "TEACHER",
      teacherProfile: { create: { institutionId: institution.id } },
    },
  });
  const course = await db.course.create({
    data: { institutionId: institution.id, teacherId: teacher.id, name: fixture.course.name, joinCode: tag.slice(0, 6).toUpperCase(), curriculumStatus: "CONFIGURED" },
  });
  await db.curriculumItem.createMany({
    data: fixture.course.topics.map((title, position) => ({ courseId: course.id, kind: "CONCEPT" as const, title, origin: "TEACHER" as const, status: "ACCEPTED" as const, position })),
  });
  const studentIds: string[] = [];

  const rows: { id: string; expected: string[]; detected: string[]; tp: number; fp: number; fn: number; status: string }[] = [];
  let costUsd = 0;
  try {
    for (const conv of fixture.conversations) {
      // Un estudiante por conversación: el historial de una no contamina a la otra.
      const student = await db.user.create({
        data: {
          email: `precision-${conv.id}-${tag}@test.educai`,
          name: `Estudiante ${conv.id}`,
          passwordHash: randomBytes(24).toString("base64url"),
          role: "STUDENT",
          studentProfile: { create: { consentAnalysisAt: new Date(), onboardingCompletedAt: new Date() } },
        },
      });
      studentIds.push(student.id);
      await db.enrollment.create({ data: { courseId: course.id, studentId: student.id } });
      const experience = await db.experience.create({ data: { courseId: course.id, studentId: student.id, type: "AI_CONVERSATION", title: conv.id, completedAt: new Date() } });
      const conversation = await db.aIConversation.create({
        data: { experienceId: experience.id, courseId: course.id, studentId: student.id, title: conv.id, status: "CLOSED", closedAt: new Date() },
      });
      const start = Date.now() - conv.messages.length * 60_000;
      await db.message.createMany({
        data: conv.messages.map((m, i) => ({ conversationId: conversation.id, role: m.role, content: m.content, createdAt: new Date(start + i * 60_000) })),
      });
      const run = await db.interpretationRun.create({
        data: { courseId: course.id, studentId: student.id, experienceId: experience.id, source: "AI_CONVERSATION", promptVersion: "precision" },
      });
      await runInterpretation(run.id);

      const finished = await db.interpretationRun.findUniqueOrThrow({ where: { id: run.id }, select: { status: true } });
      const signals = await db.signal.findMany({
        where: { runId: run.id, polarity: "DIFFICULTY", curriculumItemId: { not: null } },
        select: { curriculumItem: { select: { title: true } } },
      });
      const detected = [...new Set(signals.map((s) => s.curriculumItem!.title))];
      const expected = conv.expectedDoubts;
      const tp = detected.filter((d) => expected.includes(d)).length;
      rows.push({ id: conv.id, expected, detected, tp, fp: detected.length - tp, fn: expected.filter((e) => !detected.includes(e)).length, status: finished.status });

      const usage = await db.aIUsageEvent.aggregate({ where: { courseId: course.id }, _sum: { estimatedCostUsd: true } });
      costUsd = Number(usage._sum.estimatedCostUsd ?? 0);
      console.log(`${conv.id}: esperado [${expected.join(", ")}] · detectado [${detected.join(", ")}] · ${finished.status} · costo acumulado ${costUsd.toFixed(4)} USD`);
      if (costUsd > MAX_USD) {
        console.error(`Se superó el tope de ${MAX_USD} USD: corto la medición.`);
        break;
      }
    }
  } finally {
    // Limpieza de los datos sintéticos de la medición.
    await db.course.delete({ where: { id: course.id } }).catch(() => {});
    await db.user.deleteMany({ where: { id: { in: [teacher.id, ...studentIds] } } });
    await db.institution.delete({ where: { id: institution.id } }).catch(() => {});
  }

  const tp = rows.reduce((a, r) => a + r.tp, 0);
  const fp = rows.reduce((a, r) => a + r.fp, 0);
  const fn = rows.reduce((a, r) => a + r.fn, 0);
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

  const report = [
    `# Precisión de la detección de dudas`,
    ``,
    `${new Date().toISOString().slice(0, 10)} · ${dryRun ? "**Prueba del circuito con el proveedor guionado: los números no miden al modelo.**" : `Modelo real (${process.env.AI_MODEL_INTERPRET_SIGNALS || process.env.AI_MODEL || "modelo por defecto"})`}`,
    ``,
    `- Conversaciones: ${rows.length} de ${fixture.conversations.length}`,
    `- Dudas detectadas correctas: ${tp} · incorrectas: ${fp} · no detectadas: ${fn}`,
    `- **Precisión: ${pct(precision)}** (objetivo: al menos ${pct(TARGET)}) · Cobertura: ${pct(recall)}`,
    `- Costo: ${costUsd.toFixed(4)} USD`,
    ``,
    `| Conversación | Esperado | Detectado | Corrida |`,
    `| --- | --- | --- | --- |`,
    ...rows.map((r) => `| ${r.id} | ${r.expected.join(", ") || "—"} | ${r.detected.join(", ") || "—"} | ${r.status} |`),
    ``,
  ].join("\n");
  mkdirSync("docs/informes", { recursive: true });
  writeFileSync("docs/informes/precision-etapa-4.md", report);
  console.log(`\nPrecisión ${pct(precision)} · cobertura ${pct(recall)} · costo ${costUsd.toFixed(4)} USD. Informe en docs/informes/precision-etapa-4.md`);
  await db.$disconnect();
  if (!dryRun && precision < TARGET) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
