import { z } from "zod";
import { AIError, streamChat } from "@/server/ai";
import { dailyTutorMessageLimit } from "@/server/ai/config";
import { getSessionUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { buildTutorSystemPrompt, getOwnConversation } from "@/server/services/conversations";

/** Marca de error dentro del stream de texto (el texto del modelo nunca contiene NUL). */
const ERROR_MARK = "\u0000";
const HISTORY_LIMIT = 30;

const bodySchema = z.object({ content: z.string().trim().min(1).max(4000) });

function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;

  // Protección CSRF: solo se aceptan solicitudes del mismo origen.
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return jsonError(403, "Origen no permitido.");

  const user = await getSessionUser();
  if (!user || user.role !== "STUDENT") return jsonError(401, "Iniciá sesión como estudiante.");

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, "El mensaje debe tener entre 1 y 4000 caracteres.");

  const conversation = await getOwnConversation(conversationId, user.id);
  if (!conversation) return jsonError(404, "Conversación no encontrada.");
  if (conversation.status !== "ACTIVE") return jsonError(409, "Esta sesión ya terminó. Iniciá una nueva para seguir.");

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const sentToday = await db.message.count({
    where: { role: "STUDENT", createdAt: { gte: startOfDay }, conversation: { studentId: user.id } },
  });
  if (sentToday >= dailyTutorMessageLimit()) {
    return jsonError(429, "Llegaste al límite diario de mensajes con el tutor. Podés seguir mañana.");
  }

  const history = conversation.messages.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role === "STUDENT" ? ("user" as const) : ("assistant" as const),
    content: m.content,
  }));
  // La API requiere que el primer mensaje sea del usuario.
  while (history.length > 0 && history[0].role !== "user") history.shift();
  history.push({ role: "user", content: parsed.data.content });

  let stream: ReturnType<typeof streamChat>;
  try {
    stream = streamChat({
      operation: "tutor.reply",
      system: await buildTutorSystemPrompt(conversation.id),
      messages: history,
      context: { actorUserId: user.id, studentId: user.id, courseId: conversation.courseId },
    });
  } catch (error) {
    const message = error instanceof AIError ? error.message : "El tutor no está disponible en este momento.";
    return jsonError(503, message);
  }

  await db.message.create({ data: { conversationId: conversation.id, role: "STUDENT", content: parsed.data.content } });

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          open = false;
        }
      };
      try {
        for await (const chunk of stream.textStream) send(chunk);
        const final = await stream.done;
        if (final.text.trim()) {
          await db.message.create({ data: { conversationId: conversation.id, role: "TUTOR", content: final.text } });
        }
      } catch (error) {
        const message = error instanceof AIError ? error.message : "El tutor no pudo responder. Intentá de nuevo.";
        send(`${ERROR_MARK}${message}`);
      } finally {
        if (open) controller.close();
      }
    },
  });

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
