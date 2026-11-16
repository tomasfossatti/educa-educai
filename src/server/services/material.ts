import "server-only";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { chunkPages, extractPages, materialKind } from "@/server/material/extract";

export const MAX_MATERIAL_BYTES = 20 * 1024 * 1024;

export class MaterialError extends Error {}

/** Dónde vive el material: en una cátedra (lo ven sus estudiantes) o en la carpeta de un estudiante (solo él). */
export type MaterialScope = { courseId: string; folderId?: undefined } | { folderId: string; courseId?: undefined };

function scopeOf(scope: string | MaterialScope): { courseId: string | null; folderId: string | null } {
  if (typeof scope === "string") return { courseId: scope, folderId: null };
  if (scope.courseId) return { courseId: scope.courseId, folderId: null };
  if (scope.folderId) return { courseId: null, folderId: scope.folderId };
  throw new MaterialError("El material tiene que pertenecer a una materia o a una carpeta.");
}

/**
 * Carga un archivo de la cátedra o de la carpeta: lo guarda, extrae el texto por página y lo indexa
 * en fragmentos que conservan archivo y página. Si la extracción falla, el material queda en FAILED
 * con el motivo.
 */
export async function ingestMaterial(params: {
  courseId?: string;
  folderId?: string;
  uploadedById: string;
  fileName: string;
  mimeType: string;
  data: Uint8Array;
  module?: string | null;
  sourceUrl?: string | null;
}) {
  const owner = scopeOf(params.courseId ? { courseId: params.courseId } : { folderId: params.folderId ?? "" });
  const kind = materialKind(params.mimeType, params.fileName);
  if (!kind) throw new MaterialError("Formato no admitido. Subí un PDF, DOCX, PPTX o TXT.");
  if (params.data.byteLength === 0) throw new MaterialError("El archivo está vacío.");
  if (params.data.byteLength > MAX_MATERIAL_BYTES) throw new MaterialError("El archivo supera los 20 MB.");

  const previous = await db.material.findFirst({
    where: { ...owner, fileName: params.fileName },
    orderBy: { version: "desc" },
    select: { version: true },
  });
  const material = await db.material.create({
    data: {
      ...owner,
      module: params.module ?? null,
      sourceUrl: params.sourceUrl ?? null,
      uploadedById: params.uploadedById,
      fileName: params.fileName,
      mimeType: params.mimeType || kind,
      version: (previous?.version ?? 0) + 1,
    },
  });

  try {
    const pages = await extractPages(params.data, kind);
    const chunks = chunkPages(pages);
    if (chunks.length === 0) {
      throw new MaterialError("No encontramos texto en el archivo. Si es un PDF escaneado, subí una versión con texto.");
    }
    await db.$transaction([
      db.materialChunk.createMany({
        data: chunks.map((c) => ({ materialId: material.id, ...owner, page: c.page, position: c.position, text: c.text })),
      }),
      db.material.update({ where: { id: material.id }, data: { status: "READY", pageCount: pages.length } }),
    ]);
    return { ...material, status: "READY" as const, pageCount: pages.length, chunkCount: chunks.length };
  } catch (error) {
    const message = error instanceof MaterialError ? error.message : "No se pudo leer el archivo.";
    await db.material.update({ where: { id: material.id }, data: { status: "FAILED", error: message } });
    return { ...material, status: "FAILED" as const, error: message, chunkCount: 0 };
  }
}

export interface MaterialHit {
  chunkId: string;
  materialId: string;
  fileName: string;
  page: number;
  text: string;
  rank: number;
}

/** Términos de búsqueda seguros para to_tsquery: palabras de 3 o más letras, unidas con OR. */
export function toOrQuery(question: string): string | null {
  const terms = [...new Set(question.toLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? [])].slice(0, 24);
  return terms.length ? terms.join(" | ") : null;
}

/**
 * Busca en el material listo de una cátedra con texto completo en español. Devuelve los fragmentos
 * más relevantes con su archivo y página. Solo se usa desde servicios que ya validaron el acceso.
 */
export async function searchMaterial(scope: string | MaterialScope, question: string, limit = 6, minRank = 0.01): Promise<MaterialHit[]> {
  const query = toOrQuery(question);
  if (!query) return [];
  const owner = scopeOf(scope);
  const where = owner.courseId ? Prisma.sql`c."courseId" = ${owner.courseId}` : Prisma.sql`c."folderId" = ${owner.folderId}`;
  const rows = await db.$queryRaw<MaterialHit[]>(Prisma.sql`
    SELECT c."id" AS "chunkId", c."materialId", m."fileName", c."page", c."text",
           ts_rank(to_tsvector('spanish', c."text"), to_tsquery('spanish', ${query}))::float AS "rank"
    FROM "MaterialChunk" c
    JOIN "Material" m ON m."id" = c."materialId"
    WHERE ${where}
      AND m."status" = 'READY'
      AND to_tsvector('spanish', c."text") @@ to_tsquery('spanish', ${query})
    ORDER BY "rank" DESC, c."page" ASC
    LIMIT ${limit}`);
  return rows.filter((r) => r.rank >= minRank);
}

export async function listMaterials(scope: string | MaterialScope) {
  return db.material.findMany({
    where: scopeOf(scope),
    orderBy: [{ createdAt: "desc" }],
    select: { id: true, fileName: true, module: true, version: true, status: true, error: true, pageCount: true, createdAt: true, _count: { select: { chunks: true } } },
  });
}
