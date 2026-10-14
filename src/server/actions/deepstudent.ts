"use server";

import { z } from "zod";
import { getSessionUser } from "@/server/auth/session";
import { generateStructured, isAIConfigured } from "@/server/ai";
import type { UsageContext } from "@/server/ai/types";

export interface DeepStudentStep {
  id: string;
  phase: string;
  title: string;
  content: string;
  status: "completed" | "active" | "pending";
}

const deepStudentSchema = z.object({
  steps: z.array(
    z.object({
      id: z.string(),
      phase: z.string(),
      title: z.string(),
      content: z.string(),
      status: z.enum(["completed", "active", "pending"]),
    }),
  ).length(4),
});

async function getUsageContext(): Promise<UsageContext> {
  const user = await getSessionUser();
  return {
    actorUserId: user?.id,
    studentId: user?.role === "STUDENT" ? user.id : undefined,
  };
}

export async function runDeepStudentAgentAction(params: {
  topic: string;
  notes: string;
}): Promise<{ success: boolean; steps: DeepStudentStep[] }> {
  const context = await getUsageContext();
  const topic = params.topic.trim() || "Validación de modelo de negocio";
  const notes = params.notes.trim() || "Sin notas adicionales registradas.";

  if (isAIConfigured()) {
    try {
      const res = await generateStructured({
        operation: "deepstudent.agent",
        system:
          "Sos el agente de razonamiento autónomo de DeepStudent. Descomponés el problema del estudiante en 4 etapas secuenciales rigurosas:\n" +
          "1. FASE 1: DIAGNÓSTICO (diagnóstico del contexto, problema real vs síntoma aparente)\n" +
          "2. FASE 2: HIPÓTESIS (formulación de hipótesis falsable con métrica numérica, umbral y plazo)\n" +
          "3. FASE 3: CONTRAEJEMPLOS (identificación de sesgos de confirmación, sesgo de cortesía y riesgos de validez)\n" +
          "4. FASE 4: VERIFICACIÓN (protocolo concreto de captura de evidencia empírica en campo).\n" +
          "Generá exactamente 4 pasos, marcando la fase 1 como 'completed', la fase 2 como 'active', y las fases 3 y 4 como 'pending'. Respondé siempre en español rioplatense neutro o académico.",
        messages: [
          {
            role: "user",
            content: `Tema de estudio: ${topic}\n\nNotas y borrador del estudiante:\n${notes}`,
          },
        ],
        schema: deepStudentSchema,
        context,
      });
      return { success: true, steps: res.steps };
    } catch (err) {
      console.warn("[deepstudent] Error en generateStructured, usando generador local", err);
    }
  }

  // Generador contextual local
  return {
    success: true,
    steps: [
      {
        id: "step-1",
        phase: "FASE 1: DIAGNÓSTICO",
        title: `Descomposición y análisis contextual de «${topic}»`,
        content: `Evaluación inicial del contexto: ${notes.split("\n")[0] || topic}. Se aísla el dolor prioritario del usuario para evitar diseñar soluciones precipitadas sin confirmación empírica.`,
        status: "completed" as const,
      },
      {
        id: "step-2",
        phase: "FASE 2: HIPÓTESIS",
        title: "Formulación de supuesto falsable",
        content: `Hipótesis de trabajo para «${topic}»: Si contactamos a una muestra de clientes calificados en un plazo de 5 días hábiles con una propuesta concreta, al menos el 20% confirmará su intención con una seña o reserva medible.`,
        status: "active" as const,
      },
      {
        id: "step-3",
        phase: "FASE 3: CONTRAEJEMPLOS",
        title: "Búsqueda activa de sesgos y fallas de diseño",
        content:
          "Riesgo crítico detectado: Sesgo de cortesía. Las respuestas afirmativas no acompañadas de un compromiso real de tiempo o dinero deben descartarse para no distorsionar la métrica de validación.",
        status: "pending" as const,
      },
      {
        id: "step-4",
        phase: "FASE 4: VERIFICACIÓN",
        title: "Protocolo de recolección de evidencia",
        content:
          "Planilla de registro de conversiones verificadas vs. objeciones recurrentes. Si el umbral fijado no se alcanza al término del plazo, se procede a pivotar la propuesta.",
        status: "pending" as const,
      },
    ],
  };
}
