/**
 * El estudiante no ve jerga (regla 2 del panel simple, decisión de Tomás del 2026-11-16).
 *
 * 1. Recorre `TEXT.student` y cada bloque de `TEXT` que usan las pantallas del estudiante, ejecutando
 *    las funciones con argumentos de prueba, y falla con cualquier palabra de `STUDENT_FORBIDDEN_WORDS`.
 * 2. Recorre los archivos de las pantallas del estudiante (sin comentarios) por si hay textos escritos a mano.
 *
 * "Ficha" solo se permite en `TEXT.student.myData` y en la página de Mis datos.
 * Las excepciones de transición son las pantallas viejas que la simplificación reemplaza paso a paso;
 * el PR 12 las deja vacías. Una excepción que ya no hace falta hace fallar el test, para que no quede.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { STUDENT_FORBIDDEN_WORDS, TEXT } from "@/lib/texts";

const ROOT = join(__dirname, "..", "..");
const STUDENT_SOURCES = ["src/app/s", "src/components/student"];
/** Acciones y servicios cuyos mensajes ve el estudiante (errores, avisos): se revisan los bloques de TEXT que usan. */
const STUDENT_MESSAGE_SOURCES = ["src/server/actions/folders.ts", "src/server/actions/student.ts", "src/server/services/student-errors.ts"];
/** Donde "ficha" sí se puede decir: Mis datos, "Lo que ve mi docente sobre mí". */
const FICHA_ALLOWED_TEXT = ["student.myData"];
const FICHA_ALLOWED_FILES = [/^src\/app\/s\/\(app\)\/mis-datos\//];

/** Bloques de TEXT que usan pantallas viejas, en transición. Se vacía en el PR 12. */
const TRANSITIONAL_BLOCKS: string[] = [
  "chat",
  "consent",
  "context",
  "doubts",
  "file",
  "folders",
  "lms",
  "material",
  "myData",
  "profile",
  "upload",
];
/** Archivos de pantallas viejas, en transición. Se vacía en el PR 12. */
const TRANSITIONAL_FILES: string[] = [
  "src/app/s/(app)/layout.tsx",
  "src/app/s/(app)/context/page.tsx",
  "src/app/s/(app)/courses/[courseId]/activities/[activityId]/submission-form.tsx",
  "src/app/s/(app)/courses/[courseId]/activities/page.tsx",
  "src/app/s/(app)/courses/[courseId]/development/page.tsx",
  "src/app/s/(app)/courses/[courseId]/evidence/[evidenceId]/page.tsx",
  "src/app/s/(app)/courses/[courseId]/inferences/[inferenceId]/page.tsx",
  "src/app/s/onboarding/onboarding-form.tsx",
];

function normalize(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function forbiddenIn(text: string, allowFicha: boolean): string[] {
  const plain = normalize(text);
  return STUDENT_FORBIDDEN_WORDS.filter((w) => !(allowFicha && w === "ficha")).filter((w) =>
    new RegExp(`(^|[^a-z])${w}`).test(plain)
  );
}

/** Todas las hojas de texto de un objeto, con su ruta ("student.ask.placeholder"). */
function leaves(value: unknown, path: string): { path: string; text: string }[] {
  if (typeof value === "string") return [{ path, text: value }];
  if (typeof value === "function") {
    const fn = value as (...args: unknown[]) => unknown;
    const tries: unknown[][] = [Array(fn.length).fill("x.pdf"), Array(fn.length).fill(2), Array(fn.length).fill(["x"])];
    for (const args of tries) {
      try {
        return leaves(fn(...args), path);
      } catch {
        // probar con otros argumentos
      }
    }
    return [];
  }
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}.${i}`));
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => leaves(v, `${path}.${k}`));
  return [];
}

function files(path: string): string[] {
  const full = join(ROOT, path);
  if (!existsSync(full)) return [];
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

const sources = STUDENT_SOURCES.flatMap(files)
  .filter((f) => /\.tsx?$/.test(f))
  .map((f) => ({ file: relative(ROOT, f), content: readFileSync(f, "utf8") }));

const messageSources = STUDENT_MESSAGE_SOURCES.map((f) => readFileSync(join(ROOT, f), "utf8"));

/** Bloques de TEXT que usan las pantallas y los mensajes del estudiante, más el bloque propio. */
const studentBlocks = [
  ...new Set(["student", ...[...sources.map((s) => s.content), ...messageSources].flatMap((content) => [...content.matchAll(/TEXT\.(\w+)/g)].map((m) => m[1]))]),
];

function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1").replace(/\{\s*\}/g, "");
}

function blockFailures(block: string): string[] {
  const value = (TEXT as Record<string, unknown>)[block];
  return leaves(value, block).flatMap(({ path, text }) => {
    const allowFicha = FICHA_ALLOWED_TEXT.some((p) => path.startsWith(`${p}.`));
    return forbiddenIn(text, allowFicha).map((w) => `${path}: «${w}» en "${text}"`);
  });
}

function fileFailures(file: string, content: string): string[] {
  const allowFicha = FICHA_ALLOWED_FILES.some((r) => r.test(file));
  const code = stripComments(content)
    .split("\n")
    .filter((line) => !/^\s*import\s/.test(line))
    .join("\n");
  return forbiddenIn(code, allowFicha).map((w) => `${file}: «${w}»`);
}

describe("el estudiante no ve jerga", () => {
  it("la lista de palabras prohibidas está normalizada", () => {
    for (const w of STUDENT_FORBIDDEN_WORDS) expect(w).toBe(normalize(w));
  });

  it("detecta una palabra prohibida aunque tenga tilde o mayúscula", () => {
    expect(forbiddenIn("Tu Evidencia", false)).toEqual(["evidencia"]);
    expect(forbiddenIn("Las señales", false)).toEqual(["senal"]);
    expect(forbiddenIn("Tu ficha", true)).toEqual([]);
    expect(forbiddenIn("Lo domino", false)).toEqual([]);
  });

  it("recorre el bloque del panel simple y las pantallas del estudiante", () => {
    expect(leaves(TEXT.student, "student").length).toBeGreaterThan(50);
    expect(sources.length).toBeGreaterThan(5);
  });

  it.each(studentBlocks.filter((b) => !TRANSITIONAL_BLOCKS.includes(b)))("TEXT.%s no tiene jerga", (block) => {
    expect(blockFailures(block)).toEqual([]);
  });

  it("las pantallas del estudiante no tienen jerga escrita a mano", () => {
    const failures = sources.filter(({ file }) => !TRANSITIONAL_FILES.includes(file)).flatMap(({ file, content }) => fileFailures(file, content));
    expect(failures).toEqual([]);
  });

  it("cada excepción de transición sigue haciendo falta", () => {
    for (const block of TRANSITIONAL_BLOCKS) {
      expect(studentBlocks, `TEXT.${block} ya no lo usa el estudiante`).toContain(block);
      expect(blockFailures(block).length, `TEXT.${block} ya no tiene jerga`).toBeGreaterThan(0);
    }
    for (const file of TRANSITIONAL_FILES) {
      const source = sources.find((s) => s.file === file);
      expect(source, `${file} ya no existe`).toBeDefined();
      expect(fileFailures(file, source!.content).length, `${file} ya no tiene jerga`).toBeGreaterThan(0);
    }
  });
});
