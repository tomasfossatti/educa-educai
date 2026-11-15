import "server-only";
import { z } from "zod";
import { AccessDenied, assertFolderOwner, type Viewer } from "@/server/auth/guards";
import { loadStudentFile } from "@/server/services/student-file";

/**
 * Herramientas que el chat de una carpeta puede usar. Reciben un contexto ya filtrado por la capa
 * de permisos (el dueño de la carpeta), nunca el cliente de base de datos. Si el modelo pide datos
 * de otro estudiante, la herramienta lo rechaza aunque el pedido esté bien formulado (V13).
 */
export async function studentChatTools(viewer: Viewer, folderId: string) {
  const folder = await assertFolderOwner(viewer, folderId);
  const ctx = { studentId: viewer.id, folderId: folder.id, courseId: folder.courseId } as const;

  const studentFileInput = z.object({ studentId: z.string() });

  const handlers = {
    /** La ficha del estudiante en la materia de esta carpeta. Solo la propia. */
    async student_file(input: unknown) {
      const { studentId } = studentFileInput.parse(input);
      if (studentId !== ctx.studentId) throw new AccessDenied("El chat solo puede consultar tus propios datos.");
      if (!ctx.courseId) throw new AccessDenied("La carpeta del proyecto no tiene una ficha de materia.");
      return loadStudentFile(viewer, ctx.studentId, ctx.courseId);
    },
  };

  return {
    context: ctx,
    names: Object.keys(handlers) as (keyof typeof handlers)[],
    async execute(name: string, input: unknown) {
      if (!(name in handlers)) throw new AccessDenied(`Herramienta desconocida: ${name}`);
      return handlers[name as keyof typeof handlers](input);
    },
  };
}
