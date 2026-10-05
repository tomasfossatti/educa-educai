import type { ChatCall, ChatStream, LLMProvider, StructuredCall, UsageInfo } from "./types";

/**
 * ScriptedProvider — SOLO para desarrollo y tests (AI_PROVIDER=scripted).
 *
 * No interpreta nada: produce salidas deterministas y válidas contra cada schema,
 * citando texto real del mensaje para que la trazabilidad y las guardas se puedan
 * probar de punta a punta sin una clave de API. La interfaz muestra un aviso
 * permanente cuando está activo y el servidor lo rechaza en producción.
 */

const MODEL = "scripted-dev";

function usageFor(input: string, output: string): UsageInfo {
  return {
    model: MODEL,
    inputTokens: Math.ceil(input.length / 4),
    outputTokens: Math.ceil(output.length / 4),
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

/** Prefijo literal del texto, cortado en un límite de palabra (sigue siendo cita textual). */
function quote(text: string, max = 160): string {
  const clean = text.trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return cut.slice(0, space > 40 ? space : max).trim();
}

function firstCurriculumRef(message: string): string | null {
  return /^([COK]\d+) \[/m.exec(message)?.[1] ?? null;
}

function curriculumExtract(message: string) {
  const program = /<programa>\n([\s\S]*?)\n<\/programa>/.exec(message)?.[1] ?? "";
  const lines = program
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^([-•*]|\d+[.)])\s+/.test(l))
    .map((l) => l.replace(/^([-•*]|\d+[.)])\s+/, "").trim())
    .filter((l) => l.length >= 4);
  const plan: ["CONCEPT" | "OBJECTIVE" | "COMPETENCY" | "CRITERION", string, number][] = [
    ["CONCEPT", "C", 4],
    ["OBJECTIVE", "O", 3],
    ["COMPETENCY", "K", 2],
    ["CRITERION", "R", 2],
  ];
  const items: { ref: string; kind: (typeof plan)[number][0]; title: string; description: string; sourceExcerpt: string | null; parentRef: string | null }[] = [];
  let cursor = 0;
  for (const [kind, prefix, count] of plan) {
    for (let i = 1; i <= count && cursor < lines.length; i++, cursor++) {
      const line = lines[cursor];
      items.push({
        ref: `${prefix}${i}`,
        kind,
        title: quote(line, 80),
        description: `Ítem tomado del programa: ${line}`,
        sourceExcerpt: line,
        parentRef: kind === "CRITERION" ? "O1" : null,
      });
    }
  }
  return { items, notes: "Propuesta generada por el proveedor de prueba (AI_PROVIDER=scripted): revisala antes de confirmar." };
}

function observe(message: string) {
  const conversation = [...message.matchAll(/\[(M\d+)\] ESTUDIANTE: ([\s\S]*?)(?=\n\n\[M\d+\]|\n\nIdentificá)/g)];
  const answers = [...message.matchAll(/\[(P\d+)\] Consigna: .*\nRespuesta: ([\s\S]*?)(?=\n\n\[P\d+\]|\n\nIdentificá)/g)];
  const curriculumRef = firstCurriculumRef(message);
  const source = conversation.length > 0 ? conversation : answers;
  const observations = source
    .filter(([, , text]) => text.trim().length >= 15 && !text.includes("(sin respuesta)"))
    .slice(0, 4)
    .map(([, ref, text], i) => ({
      kind: conversation.length > 0 ? (i % 2 === 0 ? ("EXPLANATION" as const) : ("QUESTION" as const)) : ("ANSWER" as const),
      observation: conversation.length > 0 ? "El estudiante formuló una idea propia sobre el tema de la sesión." : "El estudiante respondió la consigna con una decisión propia.",
      excerpt: quote(text),
      sourceRefs: [ref],
      context: conversation.length > 0 ? "Conversación con el tutor; la respuesta siguió a una pregunta orientadora." : "Respuesta a una consigna de la actividad.",
      assistanceLevel: conversation.length > 0 ? ("LOW" as const) : ("UNKNOWN" as const),
      assistanceNote: conversation.length > 0 ? "Una pregunta orientadora del tutor." : "Ver asistencia declarada.",
      curriculumRefs: curriculumRef ? [curriculumRef] : [],
    }));
  return { observations, insufficientReason: observations.length === 0 ? "No hay producciones con contenido suficiente." : null };
}

function signals(message: string) {
  const fromConversation = message.includes("Fuente: Conversación");
  const curriculumRef = firstCurriculumRef(message);
  const observations = [...message.matchAll(/\[(E\d+)\] \([^)]*\)\nObservación: .*\nCita: "([\s\S]*?)"\n/g)];
  return {
    signals: observations.map(([, ref, excerpt]) => ({
      evidenceRef: ref,
      dimension: fromConversation ? ("COMPREHENSION" as const) : ("APPLICATION" as const),
      polarity: excerpt.length >= 120 ? ("STRENGTH" as const) : ("DIFFICULTY" as const),
      curriculumRef,
      description: excerpt.length >= 120 ? "Desarrolla la idea con un ejemplo propio." : "La respuesta queda en una afirmación general sin desarrollar.",
      rationale: "Regla del proveedor de prueba basada en la extensión de la producción.",
    })),
  };
}

function evaluate(message: string) {
  const criteria = [...message.matchAll(/^(R\d+): /gm)].map((m) => m[1]);
  const evidence = [...message.matchAll(/^\[(E\d+)\]/gm)].map((m) => m[1]);
  return {
    evaluations: criteria.map((ref) => ({
      criterionRef: ref,
      result: evidence.length > 0 ? ("PARTIALLY_MEETS" as const) : ("INSUFFICIENT_EVIDENCE" as const),
      rationale: "Comparación generada por el proveedor de prueba.",
      evidenceRefs: evidence.slice(0, 1),
    })),
  };
}

function infer(message: string) {
  const parse = (prefix: "S" | "H") =>
    [...message.matchAll(new RegExp(`\\[(${prefix}\\d+)\\] (\\w+)\\/(\\w+) sobre (\\S+)`, "g"))].map((m) => ({
      ref: m[1],
      dimension: m[2] as "COMPREHENSION" | "APPLICATION" | "TRANSFER" | "AUTONOMY",
      polarity: m[3] as "STRENGTH" | "DIFFICULTY" | "MIXED",
      item: m[4],
    }));
  const current = parse("S");
  const history = parse("H");
  const first = current[0];
  if (!first) return { inferences: [], insufficientAreas: [] };
  const supporting = current.filter((s) => s.dimension === first.dimension && s.polarity === first.polarity && s.item === first.item);
  const contradicting = history.filter(
    (h) => h.dimension === first.dimension && h.item === first.item && h.polarity !== first.polarity && h.polarity !== "MIXED" && first.polarity !== "MIXED",
  );
  const strength = first.polarity === "STRENGTH";
  return {
    inferences: [
      {
        statement: strength
          ? "Aparece evidencia de que puede desarrollar este tema con ejemplos propios en esta experiencia."
          : "Las señales sugieren dificultad para desarrollar este tema más allá de una afirmación general.",
        studentStatement: strength
          ? "En esta experiencia desarrollaste el tema con un ejemplo propio."
          : "En esta experiencia tu respuesta quedó en una afirmación general; todavía no se ve cómo lo aplicarías.",
        dimension: first.dimension,
        polarity: first.polarity,
        curriculumRef: first.item === "general" ? null : first.item,
        supportingSignalRefs: supporting.map((s) => s.ref),
        contradictingSignalRefs: contradicting.map((h) => h.ref),
        proposedSupport: contradicting.length > 0 ? ("CONTRADICTORY" as const) : ("PARTIAL" as const),
        supportRationale: "Proviene de una sola experiencia analizada por el proveedor de prueba.",
        contradictionNote: contradicting.length > 0 ? "Hay evidencia anterior en sentido opuesto sobre el mismo tema." : null,
        supersedesInferenceRef: null,
        priority: strength ? ("LOW" as const) : ("MEDIUM" as const),
        teacherAction: strength ? null : { type: "ASSIGN_PRACTICE" as const, description: "Proponer una práctica breve aplicando el concepto a un caso nuevo." },
      },
    ],
    insufficientAreas: [],
  };
}

function feedback(message: string) {
  const curriculumRef = /^Ítems curriculares:\n([COK]\d+):/m.exec(message)?.[1] ?? null;
  const activityRef = /^Actividades disponibles:\n(A\d+):/m.exec(message)?.[1] ?? null;
  return {
    summary: "En esta experiencia aparece evidencia sobre cómo desarrollás el tema. Por ahora es una sola fuente, así que conviene tomarlo como una primera señal y no como una conclusión.",
    contrastWithDeclared: null,
    nextSteps: [
      {
        type: "PRACTICE_WITH_TUTOR" as const,
        title: "Practicar el concepto con un caso nuevo",
        description: "Pedile al tutor un caso de un contexto distinto al tuyo y resolvelo explicando cada decisión.",
        curriculumRef,
        activityRef: null,
      },
      ...(activityRef
        ? [{ type: "TRY_ACTIVITY" as const, title: "Hacer la próxima actividad", description: "Aplicá lo trabajado en la actividad disponible.", curriculumRef: null, activityRef }]
        : []),
    ],
  };
}

const HANDLERS: Partial<Record<StructuredCall<unknown>["operation"], (message: string) => unknown>> = {
  "curriculum.extract": curriculumExtract,
  "interpret.observe": observe,
  "interpret.signals": signals,
  "interpret.evaluate": evaluate,
  "interpret.infer": infer,
  "interpret.feedback": feedback,
};

export class ScriptedProvider implements LLMProvider {
  readonly name = "scripted";

  isConfigured(): boolean {
    return true;
  }

  async generateStructured<T>(call: StructuredCall<T>): Promise<{ data: T; usage: UsageInfo }> {
    const handler = HANDLERS[call.operation];
    if (!handler) throw new Error(`ScriptedProvider no soporta ${call.operation}`);
    const message = call.messages.map((m) => m.content).join("\n\n");
    const data = call.schema.parse(handler(message));
    return { data, usage: usageFor(call.system + message, JSON.stringify(data)) };
  }

  streamChat(call: ChatCall): ChatStream {
    const last = call.messages[call.messages.length - 1]?.content ?? "";
    const reply = `Antes de responderte, contame con tus palabras: ¿qué entendés vos por lo que planteás («${quote(last, 60)}»)? Después probemos aplicarlo a un caso concreto. (Respuesta del proveedor de prueba.)`;
    const chunks = reply.match(/[\s\S]{1,24}/g) ?? [reply];
    async function* textStream() {
      for (const chunk of chunks) {
        await new Promise((r) => setTimeout(r, 15));
        yield chunk;
      }
    }
    return {
      textStream: textStream(),
      done: Promise.resolve({ text: reply, usage: usageFor(call.system + last, reply) }),
    };
  }
}
