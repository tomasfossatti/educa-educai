import "server-only";
import type { AccessView } from "@prisma/client";
import { AccessDenied, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";

/** Registra que alguien que no es el estudiante abrió su ficha o su evidencia (V2). */
export async function logAccess(viewer: Viewer, studentId: string, courseId: string | null, view: AccessView): Promise<void> {
  if (viewer.id === studentId) return;
  await db.accessLog.create({ data: { viewerId: viewer.id, studentId, courseId, view } });
}

/** Quién abrió mi ficha y cuándo (V9). Solo para el propio estudiante. */
export async function listAccessToMe(viewer: Viewer, take = 100) {
  if (viewer.role !== "STUDENT") throw new AccessDenied();
  const rows = await db.accessLog.findMany({
    where: { studentId: viewer.id },
    orderBy: { createdAt: "desc" },
    take,
    select: { id: true, view: true, courseId: true, createdAt: true, viewer: { select: { name: true, role: true } } },
  });
  return rows.map((r) => ({ id: r.id, view: r.view, courseId: r.courseId, createdAt: r.createdAt, viewerName: r.viewer.name, viewerRole: r.viewer.role }));
}
