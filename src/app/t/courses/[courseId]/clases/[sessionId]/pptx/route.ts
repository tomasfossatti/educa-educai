import { AccessDenied } from "@/server/auth/guards";
import { getSessionUser } from "@/server/auth/session";
import { exportSlidesPptx, SlidesError } from "@/server/services/class-sessions";

/** Descarga de los slides en PowerPoint. Solo el docente de la cátedra. */
export async function GET(_request: Request, { params }: { params: Promise<{ courseId: string; sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await getSessionUser();
  if (!user) return new Response("No autorizado", { status: 401 });
  try {
    const { fileName, data } = await exportSlidesPptx({ id: user.id, role: user.role }, sessionId);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof AccessDenied) return new Response("No encontrado", { status: 404 });
    if (error instanceof SlidesError) return new Response(error.message, { status: 409 });
    throw error;
  }
}
