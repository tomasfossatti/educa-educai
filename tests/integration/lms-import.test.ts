/**
 * Conexión con el LMS e importación de materias por chat, contra un Canvas y un Moodle de mentira con
 * datos sintéticos (tests/support/fake-lms.ts). Requiere TEST_DATABASE_URL.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { factories } from "../support/factories";
import { FAKE_TOKENS, MOODLE_USER, startFakeLms } from "../support/fake-lms";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("importación desde el LMS (integración)", () => {
  let db: typeof import("@/server/db").db;
  let lms: typeof import("@/server/services/lms");
  let assistant: typeof import("@/server/services/lms-assistant");
  let material: typeof import("@/server/services/material");
  let guards: typeof import("@/server/auth/guards");
  let crypto: typeof import("@/server/lms/crypto");
  let f: ReturnType<typeof factories>;
  let fake: Awaited<ReturnType<typeof startFakeLms>>;

  const asTeacher = (id: string) => ({ id, role: "TEACHER" as const });
  const asStudent = (id: string) => ({ id, role: "STUDENT" as const });

  /** Pide la materia por chat y corre la descarga como lo haría after() en la app. */
  async function importByChat(viewer: { id: string; role: "TEACHER" | "STUDENT" }, message: string) {
    const turn = await assistant.lmsAssistantTurn(viewer, message);
    if (turn.started && turn.importId) await lms.runLmsImport(turn.importId);
    const status = turn.importId ? await lms.getLmsImportStatus(viewer, turn.importId) : null;
    return { turn, status };
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.AI_PROVIDER = "scripted";
    process.env.LMS_ALLOW_INSECURE_URLS = "true";
    process.env.LMS_READING_HOSTS = "localhost";
    ({ db } = await import("@/server/db"));
    lms = await import("@/server/services/lms");
    assistant = await import("@/server/services/lms-assistant");
    material = await import("@/server/services/material");
    guards = await import("@/server/auth/guards");
    crypto = await import("@/server/lms/crypto");
    f = factories(db);
    fake = await startFakeLms();
  });

  afterAll(async () => {
    await fake?.close();
    delete process.env.LMS_ALLOW_INSECURE_URLS;
    delete process.env.LMS_READING_HOSTS;
  });

  it("conecta Canvas con un token válido, lo guarda cifrado y no lo devuelve", async () => {
    const t = await f.teacher();
    const { accountName } = await lms.connectLms(asTeacher(t.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "token", token: FAKE_TOKENS.teacher });
    expect(accountName).toBe("Docente Sintético");
    const stored = await db.lmsConnection.findUniqueOrThrow({ where: { userId: t.id } });
    expect(stored.credential).not.toContain(FAKE_TOKENS.teacher);
    expect(crypto.decryptSecret(stored.credential)).toBe(FAKE_TOKENS.teacher);
    const visible = await lms.getLmsConnection(asTeacher(t.id));
    expect(visible).not.toHaveProperty("credential");
  });

  it("rechaza un token inválido sin guardar nada", async () => {
    const t = await f.teacher();
    await expect(lms.connectLms(asTeacher(t.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "token", token: "token-que-no-existe" })).rejects.toThrow(/credencial/);
    expect(await db.lmsConnection.count({ where: { userId: t.id } })).toBe(0);
  });

  it("sin conexión, el chat pide conectar el LMS", async () => {
    const t = await f.teacher();
    const turn = await assistant.lmsAssistantTurn(asTeacher(t.id), 'crea la materia "costos de proyectos"');
    expect(turn.reply).toMatch(/conectá tu LMS/);
    expect(turn.importId).toBeUndefined();
  });

  it("el docente pide «crea la materia 'costos de proyectos'» y Educai crea la cátedra con 4 módulos y 16 lecturas", async () => {
    const t = await f.teacher();
    await lms.connectLms(asTeacher(t.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "token", token: FAKE_TOKENS.teacher });
    const { turn, status } = await importByChat(asTeacher(t.id), 'crea la materia "costos de proyectos"');
    expect(turn.reply).toMatch(/Creé la materia «Costos de Proyectos»/);
    expect(status).toMatchObject({ status: "DONE", total: 16, done: 16, failed: 0, modules: 4 });

    const course = await db.course.findFirstOrThrow({ where: { teacherId: t.id } });
    expect(course.name).toBe("Costos de Proyectos");
    expect(status?.href).toBe(`/t/courses/${course.id}/material`);
    const files = await db.material.findMany({ where: { courseId: course.id }, orderBy: { fileName: "asc" } });
    expect(files).toHaveLength(16);
    expect(files.every((m) => m.status === "READY" && m.folderId === null)).toBe(true);
    expect(new Set(files.map((m) => m.module))).toEqual(new Set(["Módulo 1: Fundamentos de costos", "Módulo 2: Estimación de costos", "Módulo 3: Presupuesto del proyecto", "Módulo 4: Control de costos"]));
    expect(files.map((m) => m.fileName)).toContain("Módulo 1: Fundamentos de costos · Costos fijos y variables.pdf".replace(":", " ").replace("  ", " "));
    expect(files.some((m) => m.fileName.endsWith("Lecciones aprendidas.txt"))).toBe(true);

    // El material queda indexado con archivo y página, listo para citar.
    const hits = await material.searchMaterial(course.id, "curva");
    expect(hits[0]?.fileName).toMatch(/Curva S/);

    // Sin programa cargado, la IA propone los temas con las lecturas; el docente los revisa y confirma.
    expect(status?.note).toMatch(/armo una propuesta de temas a partir de las lecturas/);
    const withCurriculum = await db.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(withCurriculum.curriculumStatus).toBe("IN_REVIEW");
    expect(withCurriculum.programText).toMatch(/^Esta materia no tiene programa cargado\./);
    expect(withCurriculum.programText).toContain("- Módulo 1 Fundamentos de costos · Costos fijos y variables\n  Comienzo: ");
    const proposed = await db.curriculumItem.findMany({ where: { courseId: course.id } });
    expect(proposed.length).toBeGreaterThan(0);
    expect(proposed.every((i) => i.origin === "AI_PROPOSED" && i.status === "PROPOSED")).toBe(true);
    const usage = await db.aIUsageEvent.count({ where: { courseId: course.id, operation: "curriculum.extract" } });
    expect(usage).toBe(1);

    // Pedirla de nuevo no duplica: reutiliza la cátedra, no baja lo que ya está y no pisa la currícula en revisión.
    const again = await importByChat(asTeacher(t.id), "creá la materia costos de proyectos");
    expect(again.turn.reply).toMatch(/Ya tenías «Costos de Proyectos»/);
    expect(again.status).toMatchObject({ status: "DONE", total: 0, note: null });
    expect(await db.curriculumItem.count({ where: { courseId: course.id } })).toBe(proposed.length);
    expect(await db.course.count({ where: { teacherId: t.id } })).toBe(1);
    expect(await db.material.count({ where: { courseId: course.id } })).toBe(16);
  });

  it("si el nombre es ambiguo o no existe, pregunta en vez de adivinar", async () => {
    const t = await f.teacher();
    await lms.connectLms(asTeacher(t.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "token", token: FAKE_TOKENS.teacher });
    const ambiguous = await assistant.lmsAssistantTurn(asTeacher(t.id), "creá la materia proyectos");
    expect(ambiguous.reply).toMatch(/varias materias parecidas: .*Costos de Proyectos.*Gestión de Proyectos|Gestión de Proyectos.*Costos de Proyectos/);
    const missing = await assistant.lmsAssistantTurn(asTeacher(t.id), "creá la materia Física Cuántica");
    expect(missing.reply).toMatch(/No encontré «Física Cuántica».*Costos de Proyectos/);
    const list = await assistant.lmsAssistantTurn(asTeacher(t.id), "¿qué materias tengo?");
    expect(list.reply).toMatch(/Costos de Proyectos.*Estrategia y Validación de Negocios/);
    expect(await db.course.count({ where: { teacherId: t.id } })).toBe(0);
  });

  it("importa las lecturas incrustadas con el formato de Siglo 21 y registra las que no se pudieron leer", async () => {
    const t = await f.teacher();
    await lms.connectLms(asTeacher(t.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "token", token: FAKE_TOKENS.teacher });
    const { status } = await importByChat(asTeacher(t.id), "traé la materia «Estrategia y Validación de Negocios»");
    expect(status).toMatchObject({ status: "DONE", total: 6, done: 5, failed: 1, modules: 3 });
    const course = await db.course.findFirstOrThrow({ where: { teacherId: t.id } });
    const files = await db.material.findMany({ where: { courseId: course.id, status: "READY" }, select: { fileName: true, mimeType: true, module: true, pageCount: true } });
    expect(files.map((m) => m.module).sort()).toEqual(["Módulo 1", "Módulo 1", "Módulo 2", "Módulo 3", "Módulo 3"]);
    // La lectura interactiva trae su PDF de descarga, con su título.
    expect(files.find((m) => m.fileName.startsWith("Módulo 1 · Lectura 1"))).toMatchObject({ fileName: "Módulo 1 · Lectura 1 - Hipótesis y experimentos.pdf", mimeType: "application/pdf" });
    // La lectura en HTML común (el formato real de Siglo 21) también trae su PDF, con páginas reales.
    expect(files.find((m) => m.fileName.startsWith("Módulo 3 · Lectura 1"))).toMatchObject({ fileName: "Módulo 3 · Lectura 1 - Canales y relaciones.pdf", mimeType: "application/pdf", pageCount: 2 });
    // Si el PDF es escaneado, se usa el texto de la página y se avisa.
    expect(files.find((m) => m.fileName.startsWith("Módulo 3 · Lectura 2"))).toMatchObject({ fileName: "Módulo 3 · Lectura 2 - Métricas de tracción.txt", mimeType: "text/plain" });
    expect(status?.note).toMatch(/^3 lecturas entraron como texto porque no tienen PDF o es escaneado: en esas, la IA cita secciones del texto en vez de páginas del PDF\. Como la materia no tiene programa cargado, armo una propuesta de temas/);
  });

  it("reemplaza las lecturas que una importación anterior guardó como texto", async () => {
    const t = await f.teacher();
    await lms.connectLms(asTeacher(t.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "token", token: FAKE_TOKENS.teacher });
    await importByChat(asTeacher(t.id), "traé la materia «Estrategia y Validación de Negocios»");
    const course = await db.course.findFirstOrThrow({ where: { teacherId: t.id } });
    // Así quedaba una lectura con la versión anterior: texto, sin título y con la clave vieja.
    const readingUrl = `${fake.url}/meca/m3l1/`;
    await db.material.deleteMany({ where: { courseId: course.id, sourceUrl: `reading2:${readingUrl}` } });
    const old = await material.ingestMaterial({
      courseId: course.id,
      uploadedById: t.id,
      fileName: "Módulo 3 · Lectura 1.txt",
      mimeType: "text/plain",
      data: new TextEncoder().encode("Módulo 3 · Lectura 1\n\nTexto de la lectura importada antes. ".repeat(10)),
      module: "Módulo 3",
      sourceUrl: `reading:${readingUrl}`,
    });
    expect(old.status).toBe("READY");

    const { status } = await importByChat(asTeacher(t.id), "traé la materia «Estrategia y Validación de Negocios»");
    expect(status).toMatchObject({ status: "DONE", total: 2, done: 1, failed: 1 });
    const module3 = await db.material.findMany({ where: { courseId: course.id, module: "Módulo 3" }, select: { fileName: true }, orderBy: { fileName: "asc" } });
    expect(module3.map((m) => m.fileName)).toEqual(["Módulo 3 · Lectura 1 - Canales y relaciones.pdf", "Módulo 3 · Lectura 2 - Métricas de tracción.txt"]);
    expect(await db.materialChunk.count({ where: { materialId: old.id } })).toBe(0);
  });

  it("el estudiante importa a una carpeta propia que no ve nadie más", async () => {
    const s = await f.student();
    const other = await f.student();
    const t = await f.teacher();
    const teacherCourse = await f.course(t.id);
    await lms.connectLms(asStudent(s.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "cookie", token: `canvas_session=${FAKE_TOKENS.student}; _csrf_token=abc` });
    const { turn, status } = await importByChat(asStudent(s.id), "creá la materia «Costos de Proyectos»");
    expect(turn.reply).toMatch(/Creé la materia/);
    expect(status).toMatchObject({ status: "DONE", total: 16, done: 16 });

    const folder = await db.folder.findFirstOrThrow({ where: { studentId: s.id, kind: "SUBJECT", createdBy: "LMS" } });
    expect(folder).toMatchObject({ name: "Costos de Proyectos", courseId: null });
    expect(status?.href).toBe(`/s/folders/${folder.id}`);
    expect(await db.material.count({ where: { folderId: folder.id, courseId: null, status: "READY" } })).toBe(16);
    expect(await db.materialChunk.count({ where: { folderId: folder.id, courseId: { not: null } } })).toBe(0);

    // El chat de su carpeta encuentra su material; ninguna cátedra lo ve.
    expect((await material.searchMaterial({ folderId: folder.id }, "valor ganado")).length).toBeGreaterThan(0);
    expect(await material.searchMaterial(teacherCourse.id, "valor ganado")).toEqual([]);
    expect(await material.listMaterials(teacherCourse.id)).toEqual([]);

    // Nadie más puede ver el estado de su importación.
    await expect(lms.getLmsImportStatus(asStudent(other.id), status!.id)).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(lms.getLmsImportStatus(asTeacher(t.id), status!.id)).rejects.toBeInstanceOf(guards.AccessDenied);
  });

  it("acepta la cookie de sesión pegada sola, sin el nombre", async () => {
    const s = await f.student();
    const { accountName } = await lms.connectLms(asStudent(s.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "cookie", token: FAKE_TOKENS.student });
    expect(accountName).toBe("Estudiante Sintético");
  });

  it("si la materia ya está en Educai con su docente, el estudiante no la duplica", async () => {
    const t = await f.teacher();
    const s = await f.student();
    const course = await f.course(t.id, { name: "Costos de proyectos" });
    await db.enrollment.create({ data: { courseId: course.id, studentId: s.id } });
    await db.folder.create({ data: { studentId: s.id, courseId: course.id, kind: "SUBJECT", name: course.name } });
    await lms.connectLms(asStudent(s.id), { provider: "CANVAS", baseUrl: fake.url, authKind: "token", token: FAKE_TOKENS.student });
    const turn = await assistant.lmsAssistantTurn(asStudent(s.id), "crea la materia costos de proyectos");
    expect(turn.reply).toMatch(/ya está en Educai con el material de tu docente/);
    expect(turn.importId).toBeUndefined();
    expect(await db.folder.count({ where: { studentId: s.id, createdBy: "LMS" } })).toBe(0);
  });

  it("conecta Moodle con usuario y contraseña sin guardar la contraseña, e importa sus unidades", async () => {
    const s = await f.student();
    await expect(lms.connectLms(asStudent(s.id), { provider: "MOODLE", baseUrl: fake.url, authKind: "password", username: MOODLE_USER.username, password: "mal" })).rejects.toThrow(/Moodle no aceptó/);
    await lms.connectLms(asStudent(s.id), { provider: "MOODLE", baseUrl: fake.url, authKind: "password", username: MOODLE_USER.username, password: MOODLE_USER.password });
    const stored = await db.lmsConnection.findUniqueOrThrow({ where: { userId: s.id } });
    expect(crypto.decryptSecret(stored.credential)).toBe(MOODLE_USER.token);
    expect(JSON.stringify(stored)).not.toContain(MOODLE_USER.password);

    const { status } = await importByChat(asStudent(s.id), "importá la materia Costos de Proyectos desde Moodle");
    expect(status).toMatchObject({ status: "DONE", total: 4, done: 4, modules: 2 });
  });

  it("el chat responde con ayuda cuando el pedido no es sobre materias, y registra el costo", async () => {
    const s = await f.student();
    const turn = await assistant.lmsAssistantTurn(asStudent(s.id), "hola, ¿qué podés hacer?");
    expect(turn.reply).toMatch(/creá la materia/);
    expect(await db.aIUsageEvent.count({ where: { studentId: s.id, operation: "lms.assistant" } })).toBe(1);
  });

  it("solo docentes y estudiantes usan el asistente", async () => {
    const a = await f.admin();
    await expect(assistant.lmsAssistantTurn({ id: a.id, role: "ADMIN" }, "crea la materia x")).rejects.toBeInstanceOf(guards.AccessDenied);
    await expect(lms.getLmsConnection({ id: a.id, role: "ADMIN" })).rejects.toBeInstanceOf(guards.AccessDenied);
  });

  it("la base no acepta material sin dueño ni con dos dueños", async () => {
    const t = await f.teacher();
    const course = await f.course(t.id);
    const s = await f.student();
    const folder = await db.folder.create({ data: { studentId: s.id, kind: "SUBJECT", name: "X", createdBy: "LMS" } });
    await expect(db.material.create({ data: { fileName: "a.txt", mimeType: "text/plain", uploadedById: t.id } })).rejects.toThrow();
    await expect(db.material.create({ data: { courseId: course.id, folderId: folder.id, fileName: "a.txt", mimeType: "text/plain", uploadedById: t.id } })).rejects.toThrow();
  });
});
