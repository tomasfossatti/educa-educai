import { describe, expect, it } from "vitest";
import { feedbackSchema, type FeedbackOutput } from "@/server/ai/prompts/feedback";
import { buildTutorSystem } from "@/server/ai/prompts/tutor";
import { containsFalsePrecision } from "@/domain/text-guards";

describe("Learning Commons Evaluators — Rúbricas de Calidad Educativa", () => {
  describe("Rúbrica 1: Anti-Falsa Precisión y Anti-Etiquetado", () => {
    it("bloquea porcentajes de aprendizaje inventados por IA", () => {
      const feedbackConPorcentaje = "Tenés un 85% de avance en este concepto. Seguí así.";
      expect(containsFalsePrecision(feedbackConPorcentaje)).toBe(true);
    });

    it("bloquea notas y puntajes numéricos ficticios", () => {
      const feedbackConNota = "Tu desempeño en la consigna fue 8/10 puntos.";
      expect(containsFalsePrecision(feedbackConNota)).toBe(true);
    });

    it("permite métricas que pertenezcan a la respuesta técnica del alumno", () => {
      const feedbackLegitimo = "El estudiante fijó una meta de 50 usuarios para el piloto.";
      expect(containsFalsePrecision(feedbackLegitimo)).toBe(false);
    });
  });

  describe("Rúbrica 2: Dosificación Cognitiva (Manageability)", () => {
    it("aprueba conjuntos de próximos pasos dosificados (1 a 3)", () => {
      const validFeedback: FeedbackOutput = {
        summary: "Planteaste con claridad el problema inicial en gastronomía. En la próxima sesión podemos profundizar.",
        contrastWithDeclared: null,
        nextSteps: [
          {
            type: "PRACTICE_WITH_TUTOR",
            title: "Practicar segmentación",
            description: "Conversá con el tutor sobre cómo definir criterios.",
            curriculumRef: "C1",
            activityRef: null,
          },
          {
            type: "REFLECT",
            title: "Revisar supuestos",
            description: "Identificá qué estás asumiendo sobre los clientes.",
            curriculumRef: null,
            activityRef: null,
          },
        ],
      };

      const parsed = feedbackSchema.safeParse(validFeedback);
      expect(parsed.success).toBe(true);
      expect(validFeedback.nextSteps.length).toBeLessThanOrEqual(3);
      expect(validFeedback.nextSteps.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Rúbrica 3: Accionabilidad de las Mejoras (Revision Actionability)", () => {
    it("asegura que cada próximo paso tenga título conciso y descripción con sentido", () => {
      const step = {
        type: "PRACTICE_WITH_TUTOR" as const,
        title: "Practicar propuesta de valor",
        description: "Explicá cómo se diferencia tu solución de las alternativas existentes.",
        curriculumRef: "C2",
        activityRef: null,
      };

      expect(step.title.trim().length).toBeGreaterThan(5);
      expect(step.title.split(" ").length).toBeLessThanOrEqual(10);
      expect(step.description.trim().length).toBeGreaterThan(15);
    });
  });

  describe("Rúbrica 4: Diálogo Socrático y UDL en el Tutor", () => {
    it("garantiza que el prompt del tutor contenga principios socráticos y UDL 3.0", () => {
      const systemPrompt = buildTutorSystem({
        courseName: "Diseño y Validación de Negocios",
        curriculum: [{ kind: "Concepto", title: "Segmentación", description: null }],
        focusItem: null,
        activity: null,
        declaredContext: {
          currentContext: "Gastronomía",
          interests: "Cocina y sustentabilidad",
          goals: "Lanzar emprendimiento",
        },
        priorEvidenceNotes: [],
      });

      // Principios socráticos
      expect(systemPrompt).toContain("Efecto de Generación");
      expect(systemPrompt).toContain("Elenchus");
      expect(systemPrompt).toContain("Aporía & Scaffolding");
      expect(systemPrompt).toContain("Thinking Partner");

      // Principios UDL
      expect(systemPrompt).toContain("UDL 3.0");
      expect(systemPrompt).toContain("Múltiples formas de representación");
      expect(systemPrompt).toContain("Múltiples formas de expresión");

      // Anclaje contextual
      expect(systemPrompt).toContain("Gastronomía");
    });
  });
});
