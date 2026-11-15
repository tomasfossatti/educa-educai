import "server-only";
import { z } from "zod";
import { generateStructured } from "@/server/ai";
import { AccessDenied, assertFolderOwner, type Viewer } from "@/server/auth/guards";
import { db } from "@/server/db";
import { onConversationClosed, queueInterpretation } from "@/server/engine/trigger";
import { contextForPrompt } from "@/server/services/folder-context";
import { searchMaterial, type MaterialHit } from "@/server/services/material";

/** Lo que se guarda en Message.citations para una respuesta del chat de carpeta. */
export interface MessageCitations {
  noSource: boolean;
  items: { n: number; chunkId: string; materialId: string; fileName: string; page: number }[];
}

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const HISTORY_MESSAGES = 12;

const answerSchema = z.object({
  answer: z.string().min(1).max(8000),
  /** Números de los fragmentos usados, tal como aparecen entre corchetes en la respuesta. */
  sources: z.array(z.number().int().positive()).max(12),
  noSource: z.boolean(),
});

const SYSTEM = `Sos el tutor de Educai dentro de una carpeta de estudio de un estudiante universitario.
Respondé en español rioplatense, claro y breve.
Reglas:
- Usá SOLO los fragmentos del material que vienen en el mensaje. Cada vez que uses uno, citalo con su número entre corchetes, por ejemplo [2].
- En "sources" poné los números de los fragmentos que citaste.
- Si los fragmentos no alcanzan para responder, decilo con claridad, no inventes, poné "noSource": true y "sources": [].
- No resuelvas por el estudiante actividades evaluadas: guialo con preguntas.`;

async function ownedConversation(viewer: Viewer, conversationId: string) {
  const conversation = await db.aIConversation.findFirst({
    where: { id: conversationId, studentId: viewer.id },
    include: { folder: true },
  });
  if (!conversation || !conversation.folder || viewer.role !== "STUDENT") throw new AccessDenied();
  return conversation as typeof conversation & { folder: NonNullable<typeof conversation.folder> };
}

/** Abre una conversación nueva en una carpeta del estudiante. */
export async function startFolderConversation(viewer: Viewer, folderId: string, title = "Conversación") {
  const folder = await assertFolderOwner(viewer, folderId);
  const experience = await db.experience.create({
    data: { courseId: folder.courseId, studentId: viewer.id, type: "AI_CONVERSATION", title },
  });
  return db.aIConversation.create({
    data: { experienceId: experience.id, courseId: folder.courseId, studentId: viewer.id, folderId: folder.id, title },
  });
}

function fragmentsBlock(hits: MaterialHit[]): string {
  if (hits.length === 0) return "FRAGMENTOS DEL MATERIAL: (ninguno encontrado)";
  return ["FRAGMENTOS DEL MATERIAL:", ...hits.map((h, i) => `[${i + 1}] ${h.fileName}, página ${h.page}:\n${h.text}`)].join("\n");
}

/**
 * Decide en código qué fuentes quedan citadas: solo números válidos que además aparecen en el texto.
 * Si no queda ninguna, la respuesta se marca sin fuente (la interfaz lo avisa).
 */
export function resolveCitations(answer: string, sources: number[], hits: MaterialHit[]): MessageCitations {
  const mentioned = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])));
  const valid = [...new Set(sources)].filter((n) => n >= 1 && n <= hits.length && mentioned.has(n)).sort((a, b) => a - b);
  return {
    noSource: valid.length === 0,
    items: valid.map((n) => {
      const h = hits[n - 1];
      return { n, chunkId: h.chunkId, materialId: h.materialId, fileName: h.fileName, page: h.page };
    }),
  };
}

/** Responde una pregunta en el chat de la carpeta, buscando en el material de su cátedra. */
export async function askInFolder(viewer: Viewer, conversationId: string, question: string) {
  const conversation = await ownedConversation(viewer, conversationId);
  const text = question.trim();
  if (!text) throw new Error("La pregunta está vacía.");

  await db.message.create({ data: { conversationId, role: "STUDENT", content: text } });
  const history = await db.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_MESSAGES,
    select: { role: true, content: true },
  });

  const hits = conversation.folder.courseId ? await searchMaterial(conversation.folder.courseId, text) : [];
  const messages = history
    .reverse()
    .slice(0, -1)
    .map((m) => ({ role: m.role === "STUDENT" ? ("user" as const) : ("assistant" as const), content: m.content }));
  messages.push({ role: "user", content: `${fragmentsBlock(hits)}\n\nPREGUNTA: ${text}` });

  const studentContext = await contextForPrompt(conversation.folder.id, viewer.id);
  const result = await generateStructured({
    operation: "folder.chat",
    system: studentContext ? `${SYSTEM}\n\n${studentContext}` : SYSTEM,
    messages,
    schema: answerSchema,
    context: { actorUserId: viewer.id, studentId: viewer.id, courseId: conversation.folder.courseId },
  });

  const citations = result.noSource ? { noSource: true, items: [] } : resolveCitations(result.answer, result.sources, hits);
  return db.message.create({
    data: { conversationId, role: "TUTOR", content: result.answer, citations: citations as unknown as object },
  });
}

/**
 * Divide una conversación pegada de otra IA en mensajes, si trae marcas de turno
 * ("Yo:", "Usuario:", "ChatGPT:", "Claude:"…). Si no las trae, queda como un solo mensaje del estudiante.
 */
export function parseExternalConversation(raw: string): { role: "STUDENT" | "TUTOR"; content: string }[] {
  const text = raw.replace(/\r\n?/g, "\n").trim();
  const marker = /^(yo|usuario|user|you|tú|vos|estudiante|chatgpt|gpt|assistant|asistente|claude|gemini|ia|ai|copilot)\s*:\s*/i;
  const student = /^(yo|usuario|user|you|tú|vos|estudiante)$/i;
  const out: { role: "STUDENT" | "TUTOR"; content: string }[] = [];
  for (const line of text.split("\n")) {
    const m = marker.exec(line.trim());
    if (m) {
      out.push({ role: student.test(m[1]) ? "STUDENT" : "TUTOR", content: line.trim().slice(m[0].length) });
    } else if (out.length) {
      out[out.length - 1].content += `\n${line}`;
    } else if (line.trim()) {
      out.push({ role: "STUDENT", content: line });
    }
  }
  return out.map((m) => ({ ...m, content: m.content.trim() })).filter((m) => m.content);
}

/** Sube una conversación de otra IA (.txt o texto pegado) a una carpeta. Se procesa al recibirla. */
export async function uploadExternalConversation(viewer: Viewer, folderId: string, input: { title?: string; text: string }) {
  const folder = await assertFolderOwner(viewer, folderId);
  if (new TextEncoder().encode(input.text).byteLength > MAX_UPLOAD_BYTES) throw new Error("La conversación supera los 2 MB.");
  const messages = parseExternalConversation(input.text);
  if (messages.length === 0) throw new Error("La conversación está vacía.");

  const title = input.title?.trim() || "Conversación subida";
  const closedAt = new Date();
  const experience = await db.experience.create({
    data: { courseId: folder.courseId, studentId: viewer.id, type: "AI_CONVERSATION", title, completedAt: closedAt },
  });
  const conversation = await db.aIConversation.create({
    data: {
      experienceId: experience.id,
      courseId: folder.courseId,
      studentId: viewer.id,
      folderId: folder.id,
      origin: "UPLOAD",
      title,
      status: "CLOSED",
      closedAt,
    },
  });
  await db.message.createMany({
    data: messages.map((m, i) => ({ conversationId: conversation.id, role: m.role, content: m.content, createdAt: new Date(closedAt.getTime() + i) })),
  });
  await onConversationClosed(conversation.id, `Conversación subida: ${title}`);
  if (folder.courseId) {
    await queueInterpretation({ experienceId: experience.id, courseId: folder.courseId, studentId: viewer.id, source: "AI_CONVERSATION" });
  }
  return conversation;
}
