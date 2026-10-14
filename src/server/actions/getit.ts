"use server";

import { z } from "zod";
import { getSessionUser } from "@/server/auth/session";
import { generateStructured, isAIConfigured } from "@/server/ai";
import type { UsageContext } from "@/server/ai/types";

const feynmanResponseSchema = z.object({
  childResponse: z.string(),
  critique: z.string(),
  clarityScore: z.number().int().min(0).max(100),
  nextPrompt: z.string(),
});

const evaluateResponseSchema = z.object({
  memory: z.number().int().min(0).max(100),
  comprehension: z.number().int().min(0).max(100),
  structure: z.number().int().min(0).max(100),
  application: z.number().int().min(0).max(100),
  evaluatorNote: z.string(),
});

async function getUsageContext(): Promise<UsageContext> {
  const user = await getSessionUser();
  return {
    actorUserId: user?.id,
    studentId: user?.role === "STUDENT" ? user.id : undefined,
  };
}

/* ──────────────── 1. TÉCNICA FEYNMAN (El estudiante enseña a un niño curioso) ──────────────── */

export async function feynmanTurnAction(params: {
  concept: string;
  explanation: string;
  history?: Array<{ speaker: "child" | "student"; text: string }>;
}): Promise<{
  success: boolean;
  childResponse: string;
  critique: string;
  clarityScore: number;
  nextPrompt: string;
}> {
  const context = await getUsageContext();
  const concept = params.concept.trim() || "Hipótesis Falsable";
  const explanation = params.explanation.trim();

  if (isAIConfigured()) {
    try {
      const historyPrompt = (params.history || [])
        .map((h) => `${h.speaker === "student" ? "Explicación del estudiante" : "Niño curioso"}: ${h.text}`)
        .join("\n");

      const res = await generateStructured({
        operation: "getit.feynman",
        system:
          "Sos el evaluador de la Técnica Feynman en Get It. Tu rol tiene dos partes:\n" +
          "1. 'childResponse': Respondés simulando a un niño de 8 años curioso, inteligente y sincero. Si el estudiante usa palabras difíciles o tecnicismos (como 'métricas cuantitativas', 'proyecciones', 'heurística'), mostrate confundido con amabilidad. Si usa una buena analogía de la vida real (juegos, golosinas, fútbol, juguetes), mostrá entusiasmo y hacé una repregunta lógica que ponga a prueba el límite del concepto.\n" +
          "2. 'critique': Como evaluador pedagógico, dale una devolución de 1-2 oraciones sobre qué tan clara y libre de jerga fue la explicación.\n" +
          "3. 'clarityScore': Puntaje de 0 a 100 evaluando la simpleza, analogía y precisión conceptual.\n" +
          "4. 'nextPrompt': La próxima pregunta o desafío para profundizar la comprensión.",
        messages: [
          {
            role: "user",
            content: `Concepto a enseñar: ${concept}\n\nHistorial del diálogo:\n${historyPrompt}\n\nÚltima explicación del estudiante:\n${explanation}`,
          },
        ],
        schema: feynmanResponseSchema,
        context,
      });

      return {
        success: true,
        childResponse: res.childResponse,
        critique: res.critique,
        clarityScore: res.clarityScore,
        nextPrompt: res.nextPrompt,
      };
    } catch (err) {
      console.warn("[getit] Error en generateStructured para feynman, usando fallback local", err);
    }
  }

  // Generador contextual local
  const expLower = explanation.toLowerCase();
  const hasJargon = expLower.includes("cuantitativ") || expLower.includes("paradigma") || expLower.includes("heurístic");
  const hasAnalogy = expLower.includes("como") || expLower.includes("juego") || expLower.includes("amigo") || expLower.includes("ejemplo");

  let childResponse = "";
  let critique = "";
  let clarityScore = 75;

  if (hasJargon) {
    childResponse = `¡Pará un poco! No entendí qué significa esa palabra tan larga. ¿Cómo me lo dirías si estuviéramos jugando en el recreo y no en una clase aburrida?`;
    critique = "Detectamos vocabulario técnico. Recordá que la técnica Feynman exige traducir los conceptos a un lenguaje elemental.";
    clarityScore = 65;
  } else if (hasAnalogy) {
    childResponse = `¡Ah, ahora sí! Entonces es como cuando acordás las reglas antes de patear un penal. Pero decime: ¿qué pasa si el otro patea y dice que no valía porque no estaba mirando? ¿Cómo sabés quién ganó de verdad?`;
    critique = "Excelente uso de una analogía cotidiana. Facilita la comprensión profunda y la retención intuitiva.";
    clarityScore = 90;
  } else {
    childResponse = `Mmm, entiendo la idea general. Pero si le quiero contar esto a mi mejor amigo mañana, ¿qué ejemplo fácil le doy para que no se quede mirándome raro?`;
    critique = "Explicación correcta en contenido. Podés mejorarla sumando un ejemplo tangible con objetos o situaciones cotidianas.";
    clarityScore = 78;
  }

  return {
    success: true,
    childResponse,
    critique,
    clarityScore,
    nextPrompt: "¿Cómo pondrías a prueba esa idea en una tarde sin gastar nada de plata?",
  };
}

/* ──────────────── 2. EVALUADOR DE DOMINIO 4-EJES (Memory, Comp, Struct, App) ──────────────── */

export async function evaluateConceptMasteryAction(params: {
  concept: string;
  currentScores: { memory: number; comprehension: number; structure: number; application: number };
  recentActionsCount: number;
}): Promise<{
  success: boolean;
  memory: number;
  comprehension: number;
  structure: number;
  application: number;
  evaluatorNote: string;
}> {
  const context = await getUsageContext();
  const { currentScores, concept, recentActionsCount } = params;

  if (isAIConfigured()) {
    try {
      const res = await generateStructured({
        operation: "getit.evaluate",
        system:
          "Sos el evaluador psicométrico de Get It. Evaluás el dominio de un concepto en 4 ejes (0 a 100):\n" +
          "1. memory: Recordación y definición precisa del término.\n" +
          "2. comprehension: Entendimiento de causalidad, 'por qué' y falsabilidad.\n" +
          "3. structure: Cómo se articula con otros conceptos del mapa de conocimiento.\n" +
          "4. application: Capacidad de resolver casos nuevos no vistos sin ayuda.\n" +
          "Regla fundamental: Por diseño de Get It, los puntajes son no decrecientes (el alumno no pierde puntos conseguidos, solo puede consolidar y avanzar). Devolvé los nuevos puntajes y una nota del evaluador breve.",
        messages: [
          {
            role: "user",
            content: `Concepto: ${concept}\nPuntajes actuales: ${JSON.stringify(currentScores)}\nAcciones de práctica completadas en la sesión: ${recentActionsCount}`,
          },
        ],
        schema: evaluateResponseSchema,
        context,
      });

      // Asegurar monotonía no decreciente
      return {
        success: true,
        memory: Math.max(currentScores.memory, res.memory),
        comprehension: Math.max(currentScores.comprehension, res.comprehension),
        structure: Math.max(currentScores.structure, res.structure),
        application: Math.max(currentScores.application, res.application),
        evaluatorNote: res.evaluatorNote,
      };
    } catch (err) {
      console.warn("[getit] Error en generateStructured para evaluate, usando cálculo local", err);
    }
  }

  // Incremento monótono local según actividad
  const gain = Math.min(15, Math.max(5, recentActionsCount * 3));
  return {
    success: true,
    memory: Math.min(100, currentScores.memory + gain),
    comprehension: Math.min(100, currentScores.comprehension + Math.round(gain * 0.9)),
    structure: Math.min(100, currentScores.structure + Math.round(gain * 0.8)),
    application: Math.min(100, currentScores.application + Math.round(gain * 0.7)),
    evaluatorNote: `Sesión de práctica registrada para «${concept}». Se consolida la retención del concepto y la capacidad de contrastación empírica.`,
  };
}
