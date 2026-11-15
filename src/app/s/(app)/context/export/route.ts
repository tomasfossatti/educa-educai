import { requireStudent } from "@/server/auth/guards";
import { exportStudentData } from "@/server/services/privacy";

/** Descarga de una copia de los datos propios (Ley 25.326, art. 14). Solo del estudiante de la sesión. */
export async function GET() {
  const { user } = await requireStudent();
  const data = await exportStudentData({ id: user.id, role: user.role });
  const date = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="educai-mis-datos-${date}.json"`,
      "cache-control": "no-store",
    },
  });
}
