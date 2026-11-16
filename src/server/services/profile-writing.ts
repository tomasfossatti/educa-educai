import "server-only";
import { z } from "zod";
import { generateStructured } from "@/server/ai";
import { AccessDenied, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";

/**
 * "Lápiz mágico": a pedido del estudiante, la IA propone una mejor redacción de un campo de su
 * perfil. Es solo una sugerencia: el estudiante decide si la usa. No agrega datos que no estén en el
 * texto (la salida se valida y se recorta en código). El costo cuenta para su tope semanal.
 */
export const IMPROVABLE_FIELDS = {
  projectDescription: { purpose: "Su proyecto personal: qué está armando o le gustaría armar, para quién y qué problema resuelve.", max: 600 },
  currentContext: { purpose: "Qué hace hoy además de estudiar: un trabajo, un emprendimiento o una organización, y su rol ahí.", max: 1500 },
  interests: { purpose: "Qué le interesa: problemas, industrias, disciplinas o tipos de actividad.", max: 1500 },
  goals: {
    purpose:
      "Qué quiere lograr: capacidades que quiere desarrollar, roles o proyectos a futuro. Si escribió una tarea, nombrá la capacidad directa que esa tarea implica (por ejemplo, de \"mejorar las ventas de X\" a \"aprender a vender X\"), sin sumar habilidades, herramientas ni métodos que no mencionó. Si querés proponer más, hacelo como pregunta en \"tip\".",
    max: 1500,
  },
  strengths: { purpose: "En qué se siente fuerte.", max: 1500 },
  difficulties: { purpose: "Qué le cuesta.", max: 1500 },
  workPreferences: { purpose: "Cómo prefiere trabajar o aprender.", max: 1500 },
} as const;

export type ImprovableField = keyof typeof IMPROVABLE_FIELDS;

export function isImprovableField(field: string): field is ImprovableField {
  return Object.prototype.hasOwnProperty.call(IMPROVABLE_FIELDS, field);
}

const outputSchema = z.object({
  suggestion: z.string().min(1).max(2000),
  /** Pregunta corta para completar el texto cuando es demasiado vago; null si no hace falta. */
  tip: z.string().max(240).nullable(),
});

const SYSTEM = `Ayudás a un estudiante universitario a redactar su perfil en Educai, una app donde estudia con una IA.
Mejorá la redacción del texto que escribió para el campo indicado.
Reglas:
- Mejorá y desarrollá lo que ya escribió: ordenalo, aclaralo y hacé explícito lo que está implícito en su texto, con más detalle que el original.
- No agregues datos nuevos: nombres, cifras, logros, habilidades, herramientas o hechos que no estén en el texto o no se deduzcan directamente de él.
- Escribí en primera persona, en español rioplatense, claro y concreto, en dos a cuatro oraciones.
- Ajustá el texto a lo que pide el campo.
- Si el texto es demasiado vago para mejorarlo sin inventar, devolvé igual una versión prolija y en "tip" una pregunta corta que lo ayude a completarlo. Si no hace falta, "tip": null.`;

export class ImproveTextError extends Error {}

/** Lo que ya escribió en otros campos, para entender a qué se refiere (no para copiarlo). */
export interface ImproveContext {
  career?: string;
  projectDescription?: string;
  currentContext?: string;
}

const clip = (v: string | null | undefined) => v?.trim().slice(0, 600) || null;

export async function improveProfileText(
  viewer: Viewer,
  field: string,
  text: string,
  formContext: ImproveContext = {},
): Promise<{ suggestion: string; tip: string | null }> {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  if (!isImprovableField(field)) throw new ImproveTextError("Ese campo no se puede mejorar.");
  const input = text.trim();
  const { purpose, max } = IMPROVABLE_FIELDS[field];
  if (input.length < 3) throw new ImproveTextError("Escribí algo primero y después lo mejoramos.");
  if (input.length > max) throw new ImproveTextError(`El texto supera los ${max} caracteres.`);

  // En el primer ingreso los otros campos todavía no están guardados: se usan los del formulario.
  const saved = await db.studentProfile.findUnique({ where: { userId: viewer.id }, select: { career: true, projectDescription: true, declaredCurrentContext: true } });
  const known = [
    ["Carrera", clip(formContext.career) ?? clip(saved?.career)],
    ["Proyecto personal", field === "projectDescription" ? null : (clip(formContext.projectDescription) ?? clip(saved?.projectDescription))],
    ["Qué hace hoy además de estudiar", field === "currentContext" ? null : (clip(formContext.currentContext) ?? clip(saved?.declaredCurrentContext))],
  ].filter((entry): entry is [string, string] => Boolean(entry[1]));
  const contextBlock = known.length
    ? `\nCONTEXTO (solo para entender a qué se refiere; no lo copies ni lo sumes al texto):\n${known.map(([k, v]) => `- ${k}: ${v}`).join("\n")}`
    : "";

  const output = await generateStructured({
    operation: "profile.improve",
    system: SYSTEM,
    messages: [{ role: "user", content: `CAMPO: ${purpose}${contextBlock}\nTEXTO DEL ESTUDIANTE: «${input}»` }],
    schema: outputSchema,
    context: { actorUserId: viewer.id, studentId: viewer.id },
  });
  return { suggestion: output.suggestion.trim().slice(0, max), tip: output.tip?.trim() || null };
}
