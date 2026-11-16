/**
 * El panel del estudiante no muestra datos inventados (PR 2 de la simplificación).
 * Recorre las páginas y componentes que ve el estudiante y los textos centralizados, y falla si
 * reaparece alguno de los valores de relleno que tuvo la página de la materia.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(__dirname, "..", "..");
const SCANNED = ["src/app/s", "src/components/student", "src/components/domain", "src/lib/texts.ts"];

/** Valores de relleno que no salen de ningún dato real. */
const PLACEHOLDERS: { name: string; pattern: RegExp }[] = [
  { name: "concepto de ejemplo", pattern: /hip[oó]tesis falsables/i },
  { name: "organización de ejemplo (Rosario)", pattern: /\bRosario\b/ },
  { name: "organización de ejemplo (restaurante)", pattern: /\brestaurante\b/i },
  { name: "organización de ejemplo (e-commerce)", pattern: /\be-commerce\b/i },
  { name: "actividad de ejemplo (logística)", pattern: /[uú]ltima milla|practice-logistics|entregas en franjas/i },
  { name: "número de clase fijo", pattern: /clase \d+ de \d+|currentClassNumber=\{\d+\}|totalClasses=\{\d+\}/i },
  { name: "botón de simulación", pattern: /Simular:/ },
];

function files(path: string): string[] {
  const full = join(ROOT, path);
  if (statSync(full).isFile()) return [full];
  return readdirSync(full).flatMap((name) => files(join(path, name)));
}

describe("panel del estudiante sin datos inventados", () => {
  const scanned = SCANNED.flatMap(files).filter((f) => /\.(tsx?|mts)$/.test(f));

  it("recorre archivos reales", () => {
    expect(scanned.length).toBeGreaterThan(10);
  });

  it.each(PLACEHOLDERS)("no aparece: $name", ({ pattern }) => {
    const hits = scanned.filter((f) => pattern.test(readFileSync(f, "utf8"))).map((f) => relative(ROOT, f));
    expect(hits).toEqual([]);
  });
});
