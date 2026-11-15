/**
 * Prueba de carga de la etapa 6: N estudiantes (60 por defecto) entran a la vez, abren su carpeta,
 * conversan en rondas simultáneas y cierran la conversación, que dispara el motor de análisis.
 * Al final verifica que no se perdió ni se duplicó nada, y escribe un informe en docs/informes/.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { cpus, totalmem } from "node:os";
import { expect, test, type Page } from "@playwright/test";
import { makePdf } from "../e2e/documents";
import { db, login, world } from "../e2e/support";

const N = Number(process.env.LOAD_STUDENTS ?? 60);
const ROUNDS = Number(process.env.LOAD_ROUNDS ?? 3);
const AI_LATENCY_MS = Number(process.env.SCRIPTED_AI_LATENCY_MS ?? 0);
const QUESTIONS = [
  "¿Qué hace falsable a una hipótesis?",
  "¿Cómo elijo la métrica y el umbral para mi proyecto?",
  "¿Qué diferencia hay entre segmentar por necesidad y por perfil?",
  "¿Me das un ejemplo de hipótesis que no sea falsable?",
];

/**
 * Criterios de aceptación (ver docs/DECISIONES.md). Se miden del lado del servidor: en esta prueba
 * los 60 navegadores comparten la máquina y su CPU domina el tiempo total que ve cada estudiante.
 */
const CRITERIA = { maxErrors: 0, loginP95Ms: 5_000, pageP95Ms: 1_500, questionP95OverAiMs: 1_000, analysisMaxMs: 5 * 60_000 };

type Phase = "login" | "carpeta" | "pregunta" | "cierre";
const samples: Record<Phase, number[]> = { login: [], carpeta: [], pregunta: [], cierre: [] };
/** Tiempo hasta el primer byte de cada documento o acción del servidor, por fase: separa al servidor de los navegadores. */
const server: Record<Phase, number[]> = { login: [], carpeta: [], pregunta: [], cierre: [] };
let currentPhase: Phase = "login";

function watchServer(page: Page) {
  page.on("requestfinished", (request) => {
    // Páginas, navegaciones internas (RSC) y acciones: todo lo que responde el servidor de la app.
    const type = request.resourceType();
    if (type !== "document" && type !== "fetch") return;
    if (new URL(request.url()).pathname.startsWith("/_next/")) return;
    const t = request.timing();
    if (t.responseStart > 0 && t.requestStart >= 0) server[currentPhase].push(Math.round(t.responseStart - t.requestStart));
  });
}
const errors: { phase: Phase; student: number; message: string }[] = [];

async function timed(phase: Phase, student: number, fn: () => Promise<void>): Promise<void> {
  const started = Date.now();
  try {
    await fn();
    samples[phase].push(Date.now() - started);
  } catch (error) {
    errors.push({ phase, student, message: (error instanceof Error ? error.message : String(error)).split("\n")[0].slice(0, 200) });
  }
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

async function uploadMaterial(page: Page, courseId: string) {
  await page.goto(`/t/courses/${courseId}/material`);
  await page.waitForLoadState("networkidle");
  await page.setInputFiles("input[type=file]", {
    name: "programa.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(
      makePdf([
        "Unidad 1. Segmentacion de mercado: por necesidad, por perfil y por comportamiento.",
        "Unidad 2. Una hipotesis falsable define el resultado que la refutaria, con metrica, umbral y plazo.",
      ]),
    ),
  });
  await page.getByRole("button", { name: "Subir e indexar" }).click();
  await expect(page.getByText("programa.pdf quedó indexado")).toBeVisible();
}

test(`${N} estudiantes conversando a la vez`, async ({ browser }) => {
  const w = await world({ students: N });
  const teacherPage = await browser.newPage();
  await login(teacherPage, w.teacher);
  await uploadMaterial(teacherPage, w.course.id);
  await teacherPage.close();

  const pages = await Promise.all(w.students.map(async () => (await browser.newContext()).newPage()));
  for (const page of pages) {
    page.setDefaultTimeout(120_000);
    watchServer(page);
  }
  const studentIds = w.students.map((s) => s.id);
  const started = Date.now();

  // 1. Todos entran a la vez (el hash de contraseñas es lo más costoso del login).
  await Promise.all(pages.map((page, i) => timed("login", i, () => login(page, w.students[i]))));

  currentPhase = "carpeta";
  // 2. Cada uno abre la carpeta de la materia y empieza una conversación.
  await Promise.all(
    pages.map((page, i) =>
      timed("carpeta", i, async () => {
        await page.locator('a[href^="/s/folders/"]', { hasText: "Materia" }).first().click();
        await page.waitForURL("**/s/folders/**");
        await page.getByRole("button", { name: "Nueva conversación" }).click();
        await page.waitForURL("**/c/**");
        await page.waitForLoadState("networkidle");
      }),
    ),
  );

  currentPhase = "pregunta";
  // 3. Rondas de preguntas simultáneas: se mide desde el envío hasta ver la respuesta.
  for (let round = 0; round < ROUNDS; round++) {
    await Promise.all(
      pages.map((page, i) =>
        timed("pregunta", i, async () => {
          await page.fill("textarea[name=question]", QUESTIONS[(i + round) % QUESTIONS.length]);
          await page.getByRole("button", { name: "Enviar" }).click();
          await expect(page.locator("ol").first().locator(":scope > li")).toHaveCount(2 * (round + 1), { timeout: 120_000 });
        }),
      ),
    );
  }

  // 4. Todos cierran la conversación a la vez, lo que encola 60 análisis.
  currentPhase = "cierre";
  const closedAt = Date.now();
  await Promise.all(
    pages.map((page, i) =>
      timed("cierre", i, async () => {
        await page.getByRole("button", { name: "Terminar y analizar" }).click();
        // El botón cambia a "Cerrando…" al hacer clic: se espera a que terminen la acción y el refresco.
        await expect(page.getByRole("button", { name: /Terminar y analizar|Cerrando/ })).toHaveCount(0, { timeout: 120_000 });
        const conversationId = new URL(page.url()).pathname.split("/c/")[1];
        const closed = await db.aIConversation.count({ where: { id: conversationId, studentId: w.students[i].id, status: "CLOSED" } });
        if (closed !== 1) {
          const body = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 300);
          throw new Error(`La conversación ${conversationId} no quedó cerrada (${page.url()}): ${body}`);
        }
      }),
    ),
  );

  // 5. Espera a que existan y terminen los análisis en segundo plano.
  let pending = N;
  while (Date.now() - closedAt < CRITERIA.analysisMaxMs) {
    const [created, running] = await Promise.all([
      db.interpretationRun.count({ where: { studentId: { in: studentIds } } }),
      db.interpretationRun.count({ where: { studentId: { in: studentIds }, status: { in: ["QUEUED", "RUNNING"] } } }),
    ]);
    pending = N - created + running;
    if (pending <= 0) break;
    await new Promise((r) => setTimeout(r, 1_000));
  }
  const analysisMs = Date.now() - closedAt;
  const totalMs = Date.now() - started;

  // Integridad: nada perdido ni duplicado.
  const [studentMessages, tutorMessages, folders, runs, conversations] = await Promise.all([
    db.message.count({ where: { role: "STUDENT", conversation: { studentId: { in: studentIds } } } }),
    db.message.count({ where: { role: "TUTOR", conversation: { studentId: { in: studentIds } } } }),
    db.folder.groupBy({ by: ["studentId"], where: { studentId: { in: studentIds } }, _count: true }),
    db.interpretationRun.groupBy({ by: ["status"], where: { studentId: { in: studentIds } }, _count: true }),
    db.aIConversation.count({ where: { studentId: { in: studentIds } } }),
  ]);
  const runsByStatus = Object.fromEntries(runs.map((r) => [r.status, r._count]));
  const foldersOk = folders.length === N && folders.every((f) => f._count === 2);
  const finishedRuns = (runsByStatus.COMPLETED ?? 0) + (runsByStatus.INSUFFICIENT ?? 0);

  const row = (phase: Phase) => {
    const v = samples[phase];
    const sv = server[phase];
    return `| ${phase} | ${v.length} | ${percentile(v, 50)} | ${percentile(v, 95)} | ${v.length ? Math.max(...v) : 0} | ${sv.length} | ${percentile(sv, 50)} | ${percentile(sv, 95)} |`;
  };
  const serverP95 = (phase: Phase) => percentile(server[phase], 95);
  const pageP95 = Math.max(serverP95("carpeta"), serverP95("cierre"));
  const checks: [string, boolean][] = [
    [`Errores: ${errors.length} (máximo ${CRITERIA.maxErrors})`, errors.length <= CRITERIA.maxErrors],
    [`Servidor, login p95: ${serverP95("login")} ms (máximo ${CRITERIA.loginP95Ms})`, serverP95("login") <= CRITERIA.loginP95Ms],
    [`Servidor, carpeta y cierre p95: ${pageP95} ms (máximo ${CRITERIA.pageP95Ms})`, pageP95 <= CRITERIA.pageP95Ms],
    [`Servidor, pregunta p95 menos la demora simulada de la IA: ${serverP95("pregunta") - AI_LATENCY_MS} ms (máximo ${CRITERIA.questionP95OverAiMs})`, serverP95("pregunta") - AI_LATENCY_MS <= CRITERIA.questionP95OverAiMs],
    [`Mensajes del estudiante: ${studentMessages} de ${N * ROUNDS}`, studentMessages === N * ROUNDS],
    [`Respuestas de la IA: ${tutorMessages} de ${N * ROUNDS}`, tutorMessages === N * ROUNDS],
    [`Conversaciones: ${conversations} de ${N}`, conversations === N],
    [`Cada estudiante con exactamente dos carpetas: ${foldersOk ? "sí" : "no"}`, foldersOk],
    [`Análisis terminados: ${finishedRuns} de ${N} en ${Math.round(analysisMs / 1000)} s (${JSON.stringify(runsByStatus)})`, finishedRuns === N && pending === 0],
  ];

  const date = new Date().toISOString().slice(0, 10);
  const report = [
    `# Prueba de carga: ${N} estudiantes a la vez`,
    "",
    `${date} · Claude Code · \`npm run test:load\``,
    "",
    "## Escenario",
    "",
    `${N} estudiantes sintéticos de una cátedra entran a la vez, abren la carpeta de la materia, hacen ${ROUNDS} preguntas en rondas simultáneas (todos envían al mismo tiempo) y cierran la conversación, lo que encola ${N} análisis del motor. Cada estudiante usa su propio contexto de navegador sobre el build de producción.`,
    "",
    `La IA es el proveedor guionado con una demora simulada de ${AI_LATENCY_MS} ms por llamada, para que las conexiones queden abiertas como con el modelo real. La prueba mide la app y la base, no la API de Anthropic, que tiene sus propios límites por minuto.`,
    "",
    `Máquina: ${cpus().length} CPU, ${Math.round(totalmem() / 2 ** 30)} GB de RAM, Node ${process.version}. ${process.env.LOAD_SERVER_CPUS ? `El servidor de la app corre limitado a ${process.env.LOAD_SERVER_CPUS.split(",").length} CPU (taskset ${process.env.LOAD_SERVER_CPUS}), como una instancia chica; PostgreSQL y los navegadores usan el resto.` : "El servidor, PostgreSQL y los navegadores comparten todas las CPU."} Los ${N} navegadores compiten por CPU entre sí, así que el tiempo total que ve cada estudiante es pesimista; los criterios se miden en el servidor. Duración total: ${Math.round(totalMs / 1000)} s.`,
    "",
    "## Tiempos (ms)",
    "",
    "Columnas 2 a 5: lo que espera el estudiante (navegador incluido). Columnas 6 a 8: tiempo hasta el primer byte de cada página o acción del servidor en esa fase.",
    "",
    "| Fase | Muestras | p50 | p95 | Máximo | Pedidos al servidor | Servidor p50 | Servidor p95 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    row("login"),
    row("carpeta"),
    row("pregunta"),
    row("cierre"),
    "",
    "## Criterios",
    "",
    ...checks.map(([label, ok]) => `- ${ok ? "Cumple" : "No cumple"}: ${label}`),
    "",
    errors.length ? "## Errores\n\n" + errors.map((e) => `- ${e.phase}, estudiante ${e.student}: ${e.message}`).join("\n") : "Sin errores.",
    "",
  ].join("\n");
  mkdirSync("docs/informes", { recursive: true });
  const cpuTag = process.env.LOAD_SERVER_CPUS ? `${process.env.LOAD_SERVER_CPUS.split(",").length}cpu` : "todas-las-cpu";
  writeFileSync(`docs/informes/carga-${date}-${cpuTag}.md`, report);
  console.log(report);

  for (const [label, ok] of checks) expect.soft(ok, label).toBe(true);
});
