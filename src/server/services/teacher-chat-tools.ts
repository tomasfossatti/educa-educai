import "server-only";
import { z } from "zod";
import { AccessDenied, assertCourseTeacher, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { getClassOverview } from "@/server/services/class-view";
import { loadStudentFile } from "@/server/services/student-file";

/**
 * Herramientas del chat del docente, atadas a una cátedra. Usan las mismas vistas del panel y
 * rechazan cualquier estudiante que no esté inscripto en esa cátedra, aunque el pedido esté bien formulado (V12).
 */
export async function teacherChatTools(viewer: Viewer, courseId: string) {
  await assertCourseTeacher(viewer, courseId);
  const studentInput = z.object({ studentId: z.string() });

  const handlers = {
    async class_overview() {
      return getClassOverview(viewer, courseId);
    },
    async student_file(input: unknown) {
      const { studentId } = studentInput.parse(input);
      const enrolled = await db.enrollment.findFirst({ where: { courseId, studentId, status: "ACTIVE" } });
      if (!enrolled) throw new AccessDenied("Ese estudiante no está en esta cátedra.");
      return loadStudentFile(viewer, studentId, courseId);
    },
  };

  return {
    context: { courseId },
    names: Object.keys(handlers) as (keyof typeof handlers)[],
    async execute(name: string, input: unknown) {
      if (!(name in handlers)) throw new AccessDenied(`Herramienta desconocida: ${name}`);
      return handlers[name as keyof typeof handlers](input);
    },
  };
}
