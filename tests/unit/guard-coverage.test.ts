/**
 * Cobertura de la capa de permisos (docs/PRUEBAS.md): recorre todas las páginas, rutas y acciones
 * del servidor y falla si alguna no pasa por un control de `src/server/auth/guards.ts` (o por la
 * sesión, en las rutas que la validan a mano). Es un control estático: una página nueva sin control
 * rompe este test antes de llegar a revisión.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const GUARD = /\b(requireUser|requireStudent|requireTeacher|requireCourseTeacher|requireEnrolledStudent|requireTeacherStudent|assertCanViewConversations|assertCanViewStudentFile|assertFolderOwner|assertCourseTeacher|getSessionUser)\s*\(/;

/** Lo único que puede responder sin sesión. */
const PUBLIC = new Set(["src/app/(auth)/login/page.tsx", "src/app/(auth)/register/page.tsx", "src/app/api/health/route.ts"]);
const PUBLIC_ACTIONS = new Set(["auth.ts:registerAction", "auth.ts:loginAction", "auth.ts:logoutAction"]);

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
}

const pages = walk(join(ROOT, "src/app"))
  .filter((f) => /\/(page\.tsx|route\.ts)$/.test(f))
  .map((f) => relative(ROOT, f));

describe("cada página y ruta pasa por la capa de permisos", () => {
  it.each(pages.filter((p) => !PUBLIC.has(p)))("%s", (file) => {
    expect(readFileSync(join(ROOT, file), "utf8")).toMatch(GUARD);
  });

  it("la lista de páginas públicas no tiene entradas viejas", () => {
    for (const p of PUBLIC) expect(pages).toContain(p);
  });
});

/** Cuerpo de cada acción exportada, hasta la próxima declaración de primer nivel. */
function actions(file: string): { name: string; body: string }[] {
  const src = readFileSync(join(ROOT, file), "utf8");
  const starts = [...src.matchAll(/^export async function (\w+)/gm)];
  return starts.map((m, i) => ({ name: m[1], body: src.slice(m.index, starts[i + 1]?.index ?? src.length) }));
}

const actionFiles = readdirSync(join(ROOT, "src/server/actions")).filter((f) => f.endsWith(".ts"));

describe("cada acción del servidor pasa por la capa de permisos", () => {
  for (const file of actionFiles) {
    const src = readFileSync(join(ROOT, "src/server/actions", file), "utf8");
    // Helpers locales (no exportados) que llaman a un control, como viewer() u ownedItem().
    const helpers = [...src.matchAll(/^(?:async )?function (\w+)\([^)]*\)[^{]*\{([\s\S]*?)^\}/gm)]
      .filter((m) => GUARD.test(m[2]))
      .map((m) => m[1]);
    const callsHelper = (body: string) => helpers.some((h) => new RegExp(`\\b${h}\\(`).test(body));
    for (const { name, body } of actions(`src/server/actions/${file}`)) {
      if (PUBLIC_ACTIONS.has(`${file}:${name}`)) continue;
      it(`${file}: ${name}`, () => {
        const guarded = GUARD.test(body) || callsHelper(body);
        expect(guarded, `${name} no llama a ningún control de permisos`).toBe(true);
      });
    }
  }
});
