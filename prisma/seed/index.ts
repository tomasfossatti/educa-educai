/**
 * Seed de demostración de Educai.
 *
 * Escenario: materia "Estrategia y Validación de Negocios", 1 docente, 8 estudiantes.
 *  - Currícula confirmada (conceptos, objetivos, competencias, criterios).
 *  - Challenge inicial entregado por 6 estudiantes + 4 conversaciones con el tutor.
 *  - Patrón del curso: comprensión razonable pero aplicación débil en "Hipótesis falsables".
 *  - Contradicción (Valentina, segmentación), evidencia insuficiente, revisiones docentes
 *    (confirmar, parcialmente correcto, incorrecto, falta contexto).
 *  - Intervención docente + práctica en otro contexto (logística) + nueva evidencia posterior.
 *  - Snapshots calculados con la lógica real en tres momentos (historial longitudinal).
 *
 * Todo lo creado acá queda marcado con origin "seed". Ejecutar: npm run db:seed
 */
import type { Prisma } from "@prisma/client";
import { hashPassword } from "@/server/auth/password";
import { db } from "@/server/db";
import { computeAndStoreSnapshot } from "@/server/engine/snapshot";
import {
  addMinutes,
  daysAgo,
  seedConversation,
  seedEvaluation,
  seedEvidence,
  seedFeedback,
  seedInference,
  seedRun,
  seedSignal,
  seedSubmission,
} from "./builders";

export const DEMO_PASSWORD = "educai-demo-2026";
const DEMO_DOMAIN = "demo.educai.test";
const INSTITUTION = "Universidad Demo (datos de demostración)";

const PROGRAM = `Estrategia y Validación de Negocios — Programa 2026

Fundamentación
La materia propone que los estudiantes aprendan a tomar decisiones de negocio con evidencia: entender a quién le resuelven un problema, formular hipótesis que se puedan comprobar y diseñar experimentos baratos antes de invertir.

Contenidos
- Segmentación de mercado: criterios basados en necesidades y comportamientos.
- Propuesta de valor y ajuste problema-solución.
- Diferencia entre problema y solución.
- Hipótesis de negocio falsables: métrica, umbral y plazo.
- Métricas de validación y experimentos simples.

Objetivos de aprendizaje
1. Elegir y justificar un segmento objetivo inicial.
2. Formular hipótesis de negocio verificables.
3. Diseñar un experimento de validación simple.

Competencias
- Pensamiento analítico con datos.
- Argumentación de decisiones.

Evaluación
Se valorará que las hipótesis sean falsables (métrica, umbral y plazo), que la segmentación use necesidades o comportamientos y que cada decisión se justifique con evidencia o supuestos explícitos.`;

async function reset() {
  const users = await db.user.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } }, select: { id: true } });
  const ids = users.map((u) => u.id);
  const institutions = await db.institution.findMany({ where: { name: INSTITUTION }, select: { id: true } });
  await db.productEvent.deleteMany({ where: { OR: [{ userId: { in: ids } }, { studentId: { in: ids } }, { course: { institutionId: { in: institutions.map((i) => i.id) } } }] } });
  await db.course.deleteMany({ where: { institutionId: { in: institutions.map((i) => i.id) } } });
  await db.user.deleteMany({ where: { id: { in: ids } } });
  await db.institution.deleteMany({ where: { id: { in: institutions.map((i) => i.id) } } });
}

async function main() {
  try {
    await db.$executeRawUnsafe("DISCARD ALL;");
  } catch {
    // ignore if not supported by driver
  }
  await reset();
  const passwordHash = await hashPassword(DEMO_PASSWORD);

  // ───────────── Docente, institución y materia ─────────────
  const institution = await db.institution.create({ data: { name: INSTITUTION } });
  const teacher = await db.user.create({
    data: {
      email: `docente@${DEMO_DOMAIN}`,
      name: "Mariana Ríos",
      passwordHash,
      role: "TEACHER",
      createdAt: daysAgo(20),
      teacherProfile: { create: { institutionId: institution.id } },
    },
  });
  const course = await db.course.create({
    data: {
      institutionId: institution.id,
      teacherId: teacher.id,
      name: "Estrategia y Validación de Negocios",
      description: "Tomar decisiones de negocio con evidencia: segmentación, hipótesis falsables y experimentos simples.",
      joinCode: "DEMO26",
      programText: PROGRAM,
      curriculumStatus: "CONFIGURED",
      curriculumConfirmedAt: daysAgo(15),
      curriculumNotes: "El programa no detalla criterios por actividad: los criterios se derivaron del apartado de Evaluación.",
      createdAt: daysAgo(18),
    },
  });
  const courseId = course.id;

  // ───────────── Currícula ─────────────
  let position = 0;
  async function item(kind: "CONCEPT" | "OBJECTIVE" | "COMPETENCY" | "CRITERION", title: string, description: string, sourceExcerpt: string | null, parentId?: string, origin: "AI_PROPOSED" | "TEACHER" = "AI_PROPOSED") {
    return db.curriculumItem.create({
      data: { courseId, kind, title, description, sourceExcerpt, parentId: parentId ?? null, origin, status: "ACCEPTED", position: position++, createdAt: daysAgo(16) },
    });
  }
  const C1 = await item("CONCEPT", "Segmentación de mercado", "Elegir a quién servir primero según necesidades y comportamientos, no solo datos demográficos.", "Segmentación de mercado: criterios basados en necesidades y comportamientos.");
  const C2 = await item("CONCEPT", "Propuesta de valor", "Qué problema resuelve la oferta, para quién y por qué es mejor que las alternativas.", "Propuesta de valor y ajuste problema-solución.");
  const C3 = await item("CONCEPT", "Problema vs. solución", "Describir la dificultad del cliente sin presuponer la solución.", "Diferencia entre problema y solución.");
  const C4 = await item("CONCEPT", "Hipótesis falsables", "Hipótesis que pueden resultar falsas: definen métrica, umbral y plazo.", "Hipótesis de negocio falsables: métrica, umbral y plazo.");
  const C5 = await item("CONCEPT", "Métricas de validación", "Indicadores que conectan un experimento con una decisión.", "Métricas de validación y experimentos simples.");
  const O1 = await item("OBJECTIVE", "Elegir y justificar un segmento objetivo", "Seleccionar un segmento inicial y justificarlo con necesidades o comportamientos.", "Elegir y justificar un segmento objetivo inicial.");
  const O2 = await item("OBJECTIVE", "Formular hipótesis de negocio verificables", "Expresar supuestos como hipótesis que un experimento pueda refutar.", "Formular hipótesis de negocio verificables.");
  const O3 = await item("OBJECTIVE", "Diseñar un experimento de validación simple", "Plantear una prueba barata, acotada y con comparación.", "Diseñar un experimento de validación simple.");
  await item("COMPETENCY", "Pensamiento analítico con datos", "Usar datos para decidir y reconocer sus límites.", "Pensamiento analítico con datos.");
  const K2 = await item("COMPETENCY", "Argumentación de decisiones", "Justificar decisiones con evidencia o supuestos explícitos.", "Argumentación de decisiones.");
  const R1 = await item("CRITERION", "La hipótesis es falsable (métrica, umbral y plazo)", "La hipótesis define qué se va a medir, qué resultado la refuta y en qué plazo.", "que las hipótesis sean falsables (métrica, umbral y plazo)", O2.id);
  const R2 = await item("CRITERION", "La segmentación usa necesidades o comportamientos", "No se limita a edad, género o ingreso.", "que la segmentación use necesidades o comportamientos", O1.id);
  const R3 = await item("CRITERION", "La decisión se justifica con evidencia o supuestos explícitos", "Distingue lo que sabe de lo que supone.", "que cada decisión se justifique con evidencia o supuestos explícitos", K2.id, "TEACHER");

  // ───────────── Estudiantes ─────────────
  async function student(slug: string, name: string, declared: { context: string; interests?: string; goals: string; strengths?: string; difficulties?: string; work?: string }, opts: { consent?: boolean; share?: boolean; joinedDaysAgo?: number } = {}) {
    const consent = opts.consent ?? true;
    const user = await db.user.create({
      data: {
        email: `${slug}@${DEMO_DOMAIN}`,
        name,
        passwordHash,
        role: "STUDENT",
        createdAt: daysAgo(opts.joinedDaysAgo ?? 14),
        studentProfile: {
          create: {
            declaredCurrentContext: declared.context,
            declaredInterests: declared.interests ?? null,
            declaredGoals: declared.goals,
            declaredStrengths: declared.strengths ?? null,
            declaredDifficulties: declared.difficulties ?? null,
            declaredWorkPreferences: declared.work ?? null,
            declaredUpdatedAt: daysAgo(opts.joinedDaysAgo ?? 14),
            consentAnalysisAt: consent ? daysAgo(opts.joinedDaysAgo ?? 14) : null,
            consentVersion: consent ? "2026-10" : null,
            shareContextWithTeachers: opts.share ?? true,
            onboardingCompletedAt: daysAgo(opts.joinedDaysAgo ?? 14),
          },
        },
      },
    });
    await db.enrollment.create({ data: { courseId, studentId: user.id, joinedAt: daysAgo(opts.joinedDaysAgo ?? 14) } });
    return user;
  }

  const lucia = await student("lucia", "Lucía Fernández", {
    context: "Trabajo en el área comercial de un restaurante en el centro de Rosario.",
    interests: "Ventas, crecimiento de negocios gastronómicos y experiencia del cliente.",
    goals: "Desarrollar pensamiento estratégico y, más adelante, emprender con un negocio propio.",
    strengths: "Me llevo bien con la gente y entiendo rápido qué necesita un cliente.",
    difficulties: "Siento que me cuesta trabajar con datos y números.",
    work: "Aprendo mejor con ejemplos concretos.",
  });
  const mateo = await student("mateo", "Mateo Gómez", {
    context: "Trabajo en logística de un e-commerce de electrodomésticos.",
    interests: "Operaciones y tecnología.",
    goals: "Liderar un equipo y entender mejor cómo se decide qué producto lanzar.",
    strengths: "Soy organizado y cumplo plazos.",
    difficulties: "Me cuesta explicar por escrito por qué decido algo.",
  });
  const valentina = await student("valentina", "Valentina Suárez", {
    context: "Estudio diseño y hago trabajos freelance de interfaces.",
    interests: "Experiencia de usuario y productos digitales.",
    goals: "Trabajar en producto en una empresa de tecnología.",
    strengths: "Creatividad y empatía con usuarios.",
    difficulties: "Los números y las métricas.",
  });
  const joaquin = await student("joaquin", "Joaquín Pereyra", {
    context: "Tengo un emprendimiento de mates artesanales que vendo por redes y en ferias.",
    interests: "Emprender y vender online.",
    goals: "Escalar el emprendimiento sin perder plata en pruebas.",
    strengths: "Soy práctico, me gusta probar.",
    difficulties: "La teoría me aburre un poco.",
  });
  const camila = await student("camila", "Camila Ortiz", {
    context: "Trabajo en atención al cliente en un banco.",
    interests: "Finanzas y análisis de datos.",
    goals: "Pasar a un área de análisis comercial.",
    strengths: "Me manejo bien con planillas y datos.",
    difficulties: "Exponer en público.",
  });
  const sofia = await student("sofia", "Sofía Medina", {
    context: "Trabajo en la empresa agrícola de mi familia, cerca de Casilda.",
    interests: "Agro, sustentabilidad y gestión.",
    goals: "Modernizar la gestión comercial de la empresa familiar.",
    strengths: "Constancia y conocimiento del sector.",
  });
  await student("martin", "Martín Acosta", { context: "Trabajo como vendedor en una concesionaria.", goals: "Aprender a armar un plan de negocio." }, { joinedDaysAgo: 6 });
  await student("julieta", "Julieta Ramos", { context: "Estudio administración.", goals: "Entender cómo validar ideas." }, { consent: false, share: false, joinedDaysAgo: 5 });

  // ───────────── Actividades ─────────────
  const baseline = await db.activity.create({
    data: {
      courseId,
      title: "Challenge inicial: viandas saludables por suscripción",
      kind: "BASELINE",
      scenario:
        "Un emprendimiento quiere lanzar en Rosario un servicio de viandas saludables por suscripción semanal. Tiene presupuesto para una prueba de dos semanas y necesita decidir por dónde empezar.",
      instructions: "Respondé cada consigna explicando tus decisiones. No hay una única respuesta correcta: importa cómo lo justificás.",
      prompts: [
        { key: "p1", label: "¿Qué segmento de clientes elegirías primero y por qué?", help: "Elegí uno concreto." },
        { key: "p2", label: "Formulá una hipótesis que puedas comprobar en las dos semanas de prueba.", help: "" },
        { key: "p3", label: "¿Qué dato mirarías para saber si la hipótesis se cumple, y qué resultado te haría cambiar de idea?", help: "" },
        { key: "p4", label: "¿Qué supuesto de tu propuesta te genera más dudas?", help: "" },
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(13),
      createdAt: daysAgo(14),
      curriculumLinks: { create: [C1, C3, C4, C5, O1, O2, R1, R2, R3].map((i) => ({ curriculumItemId: i.id })) },
    },
  });
  const practice = await db.activity.create({
    data: {
      courseId,
      title: "Práctica: hipótesis falsables en logística de última milla",
      kind: "PRACTICE",
      scenario:
        "Una empresa de logística quiere ofrecer entregas en franjas de una hora, con un costo extra, a clientes de comercios online. No sabe si alguien pagaría por ese servicio.",
      instructions: "Aplicá lo trabajado en clase sobre hipótesis en este contexto nuevo.",
      prompts: [
        { key: "p1", label: "Formulá una hipótesis falsable sobre la demanda del nuevo servicio.", help: "Incluí métrica, umbral y plazo." },
        { key: "p2", label: "¿Cómo diseñarías el experimento para comprobarla?", help: "" },
        { key: "p3", label: "¿Qué resultado te haría descartar la idea?", help: "" },
      ],
      status: "PUBLISHED",
      publishedAt: daysAgo(7, 18),
      createdAt: daysAgo(7, 17),
      curriculumLinks: { create: [C4, C5, O2, O3, R1].map((i) => ({ curriculumItemId: i.id })) },
    },
  });
  await db.activity.create({
    data: {
      courseId,
      title: "Challenge: propuesta de valor para un club de barrio",
      kind: "CHALLENGE",
      scenario: "Un club de barrio pierde socios jóvenes y quiere diseñar una propuesta para recuperarlos.",
      instructions: "Definí el problema antes de proponer soluciones.",
      prompts: [
        { key: "p1", label: "¿Cuál es el problema del cliente, sin mencionar soluciones?", help: "" },
        { key: "p2", label: "¿Qué propuesta de valor harías y por qué?", help: "" },
      ],
      status: "DRAFT",
      createdAt: daysAgo(1),
      curriculumLinks: { create: [C2, C3].map((i) => ({ curriculumItemId: i.id })) },
    },
  });

  const run = (r: Awaited<ReturnType<typeof seedRun>>) => ({ id: r.id, courseId, studentId: r.studentId, experienceId: r.experienceId, source: r.source });

  // ═════════════ LUCÍA ═════════════
  // Challenge inicial
  const lAnswers = {
    p1: "Elegiría oficinistas del microcentro que almuerzan en el escritorio, porque ya compran comida todos los días y valoran no perder tiempo. Lo veo en el restaurante donde trabajo: al mediodía los pedidos para llevar son de gente de oficinas.",
    p2: "A la gente le van a encantar las viandas saludables si son ricas y llegan a tiempo.",
    p3: "Miraría la tasa de recompra semanal: si al menos el 30% de los que prueban vuelve a pedir en la segunda semana, sigo. Si es menos del 15%, cambiaría el segmento.",
    p4: "Que estén dispuestos a pagar una suscripción y no solo pedidos sueltos.",
  };
  const lBase = await seedSubmission({ courseId, studentId: lucia.id, activity: baseline, answers: lAnswers, declaredAssistance: "NONE", confidence: "MEDIUM", at: daysAgo(12, 21) });
  const lBaseRun = await seedRun({ courseId, studentId: lucia.id, experienceId: lBase.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(12, 21), 2) });
  const lB1 = await seedEvidence({ run: run(lBaseRun), kind: "DECISION", observation: "Eligió como segmento inicial a oficinistas del microcentro y lo justificó con un comportamiento que observa en su trabajo.", content: "Elegiría oficinistas del microcentro que almuerzan en el escritorio, porque ya compran comida todos los días y valoran no perder tiempo.", sourceText: lAnswers.p1, context: "Challenge inicial, consigna 1. Sin asistencia declarada.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 21), itemIds: [C1.id, O1.id], promptKeys: ["p1"], submissionId: lBase.submission.id });
  const lB2 = await seedEvidence({ run: run(lBaseRun), kind: "HYPOTHESIS", observation: "Formuló la hipótesis como una afirmación sobre el gusto de los clientes, sin métrica ni plazo.", content: lAnswers.p2, sourceText: lAnswers.p2, context: "Challenge inicial, consigna 2. Sin asistencia declarada.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 21), itemIds: [C4.id, O2.id], promptKeys: ["p2"], submissionId: lBase.submission.id });
  const lB3 = await seedEvidence({ run: run(lBaseRun), kind: "ANALYSIS", observation: "Definió una métrica (recompra semanal) con umbrales para continuar o cambiar de segmento.", content: "Miraría la tasa de recompra semanal: si al menos el 30% de los que prueban vuelve a pedir en la segunda semana, sigo.", sourceText: lAnswers.p3, context: "Challenge inicial, consigna 3. Sin asistencia declarada.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 21), itemIds: [C5.id], promptKeys: ["p3"], submissionId: lBase.submission.id });
  const sLB1 = await seedSignal({ evidence: lB1, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C1.id, description: "Usa comportamiento de compra y una necesidad (ahorrar tiempo) como criterio de segmentación.", rationale: "La elección se justifica por qué hacen y qué necesitan, no por datos demográficos." });
  const sLB2 = await seedSignal({ evidence: lB2, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, description: "Formula la hipótesis como afirmación no verificable (sin métrica, umbral ni plazo).", rationale: "«Les van a encantar» no puede resultar falsa en dos semanas." });
  const sLB3 = await seedSignal({ evidence: lB3, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C5.id, description: "Elige una métrica de comportamiento con umbral de decisión explícito.", rationale: "Conecta el dato (recompra) con una decisión (seguir o cambiar)." });
  await seedEvaluation({ run: run(lBaseRun), submissionId: lBase.submission.id, criterionId: R1.id, result: "PARTIALLY_MEETS", rationale: "La hipótesis de la consigna 2 no define métrica ni plazo; en la consigna 3 aparece un umbral, pero no está conectado con la hipótesis.", evidenceIds: [lB2.id, lB3.id], at: lBaseRun.createdAt });
  await seedEvaluation({ run: run(lBaseRun), submissionId: lBase.submission.id, criterionId: R2.id, result: "MEETS", rationale: "Segmenta por comportamiento (almuerzan en el escritorio) y necesidad (ahorrar tiempo).", evidenceIds: [lB1.id], at: lBaseRun.createdAt });
  await seedEvaluation({ run: run(lBaseRun), submissionId: lBase.submission.id, criterionId: R3.id, result: "MEETS", rationale: "Justifica el segmento con una observación de su trabajo.", evidenceIds: [lB1.id], at: lBaseRun.createdAt });
  const iL1 = await seedInference({ run: lBaseRun, at: lBaseRun.createdAt, statement: "En el challenge inicial, la hipótesis de Lucía aparece como una afirmación no verificable (sin métrica, umbral ni plazo), aunque en otra consigna define un umbral de decisión.", studentStatement: "En el challenge inicial formulaste la hipótesis como una afirmación («a la gente le van a encantar…») que no se puede comprobar; en la consigna siguiente sí definiste un umbral, pero no quedó conectado con la hipótesis.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, support: "PARTIAL", rationale: "Una sola evidencia de una sola experiencia.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sLB2 }], teacherAction: { type: "EXPLAIN_IN_CLASS", description: "Mostrar en clase cómo convertir una afirmación en una hipótesis con métrica, umbral y plazo.", done: true } });
  const iL2 = await seedInference({ run: lBaseRun, at: lBaseRun.createdAt, statement: "Aparece evidencia de que Lucía puede elegir una métrica de comportamiento con un umbral de decisión explícito (una sola evidencia).", studentStatement: "Elegiste una métrica concreta —la recompra semanal— y definiste qué resultado te haría cambiar de idea. Por ahora es una sola evidencia.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C5.id, support: "PARTIAL", rationale: "Una sola evidencia, sin asistencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sLB3 }] });
  const iL0 = await seedInference({ run: lBaseRun, at: lBaseRun.createdAt, statement: "Lucía segmenta a partir de comportamientos y necesidades observadas, no de datos demográficos.", studentStatement: "Elegiste el segmento por lo que esas personas hacen y necesitan, a partir de algo que observás en tu trabajo.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C1.id, support: "PARTIAL", rationale: "Una evidencia, coherente con el criterio de la materia.", requiresReview: false, priority: "LOW", supports: [{ signal: sLB1 }] });
  const lBaseFb = await seedFeedback({
    run: run(lBaseRun),
    at: addMinutes(lBaseRun.createdAt, 1),
    viewed: true,
    summary: "En el challenge inicial justificaste el segmento con algo que observás en tu trabajo y elegiste una métrica concreta con un umbral para decidir. La hipótesis, en cambio, quedó como una afirmación difícil de comprobar.",
    contrast: "Al comenzar mencionaste que te cuesta trabajar con datos. En esta actividad elegiste una métrica y un umbral de decisión razonables; todavía es una sola evidencia, pero es una señal a seguir mirando.",
    inferenceIds: [iL1.id, iL2.id, iL0.id],
    evidenceIds: [lB1.id, lB2.id, lB3.id],
    nextSteps: [{ type: "PRACTICE_WITH_TUTOR", title: "Convertir tu afirmación en una hipótesis falsable", description: "Practicá con el tutor cómo reescribir «les van a encantar» con métrica, umbral y plazo.", itemId: C4.id, status: "DONE" }],
  });

  // Conversación con el tutor (desde el próximo paso sugerido)
  const lConv = await seedConversation({
    courseId,
    studentId: lucia.id,
    title: "Hipótesis falsables",
    focusItemId: C4.id,
    suggestedActionId: lBaseFb.actions[0].id,
    start: daysAgo(10, 19),
    messages: [
      ["STUDENT", "Hola, en el challenge puse que a la gente le iban a encantar las viandas y me marcaron que no es una hipótesis falsable. No termino de entender qué le falta."],
      ["TUTOR", "Buena pregunta. Antes de explicarte nada: ¿cómo sabrías, al final de las dos semanas, si esa frase resultó verdadera o falsa?"],
      ["STUDENT", "Supongo que si la gente compra... pero 'encantar' no lo puedo medir, ¿eso es lo que falla?"],
      ["TUTOR", "Vas bien. ¿Qué tendría que pasar, en números y en un plazo, para que digas «me equivoqué»?"],
      ["STUDENT", "Entonces sería algo como: al menos 40 de los 200 oficinistas que reciben el folleto se suscriben en las primeras dos semanas. Si son menos de 20, la hipótesis es falsa. Ahí tengo métrica, umbral y plazo."],
      ["TUTOR", "Exacto: ahora la frase puede resultar falsa, y eso es lo que la hace útil. ¿Cómo lo aplicarías a otro supuesto de tu propuesta, por ejemplo el de la suscripción?"],
      ["STUDENT", "Podría decir que al menos la mitad de los que se suscriben renuevan la segunda semana. Igual me cuesta pensarlo sin que me guíes."],
    ],
  });
  const m = lConv.messages;
  const lConvRun = await seedRun({ courseId, studentId: lucia.id, experienceId: lConv.experience.id, source: "AI_CONVERSATION", at: addMinutes(daysAgo(10, 19), 25) });
  const lC1 = await seedEvidence({ run: run(lConvRun), kind: "EXPLANATION", observation: "Reformuló su hipótesis incluyendo métrica, umbral y plazo, después de dos preguntas orientadoras del tutor.", content: "al menos 40 de los 200 oficinistas que reciben el folleto se suscriben en las primeras dos semanas. Si son menos de 20, la hipótesis es falsa. Ahí tengo métrica, umbral y plazo.", sourceText: m[4].content, context: "Conversación sobre hipótesis falsables; la reformulación llegó después de dos preguntas orientadoras del tutor.", assistance: "MEDIUM", assistanceSource: "OBSERVED", assistanceNote: "Dos preguntas orientadoras previas.", at: m[4].createdAt, itemIds: [C4.id, O2.id], messageIds: [m[1].id, m[3].id, m[4].id] });
  const lC2 = await seedEvidence({ run: run(lConvRun), kind: "REFLECTION", observation: "Aplicó la misma estructura a un segundo supuesto y señaló que le cuesta hacerlo sin guía.", content: m[6].content, sourceText: m[6].content, context: "Después de que el tutor le pidiera aplicarlo a otro supuesto.", assistance: "MEDIUM", assistanceSource: "OBSERVED", at: m[6].createdAt, itemIds: [C4.id], messageIds: [m[5].id, m[6].id] });
  const lC3 = await seedEvidence({ run: run(lConvRun), kind: "QUESTION", observation: "Preguntó qué le falta a su hipótesis para ser falsable.", content: "No termino de entender qué le falta.", sourceText: m[0].content, context: "Inicio de la conversación.", assistance: "NONE", assistanceSource: "OBSERVED", at: m[0].createdAt, itemIds: [C2.id], messageIds: [m[0].id] });
  const sLC1 = await seedSignal({ evidence: lC1, dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, description: "Explica qué hace falsable a una hipótesis (métrica, umbral y plazo).", rationale: "Lo nombra explícitamente y lo aplica a su caso." });
  const sLC1b = await seedSignal({ evidence: lC2, dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, description: "Reutiliza la estructura de hipótesis con un segundo supuesto.", rationale: "Generaliza la idea a otro supuesto de su propuesta." });
  const sLC2 = await seedSignal({ evidence: lC2, dimension: "AUTONOMY", polarity: "DIFFICULTY", itemId: C4.id, description: "Declara necesitar guía para formular hipótesis.", rationale: "«Me cuesta pensarlo sin que me guíes»." });
  const sLC3 = await seedSignal({ evidence: lC3, dimension: "COMPREHENSION", polarity: "DIFFICULTY", itemId: C2.id, description: "Muestra dudas sobre la propuesta de valor.", rationale: "Pregunta qué le falta a su propuesta." });
  const iL3 = await seedInference({ run: lConvRun, at: lConvRun.createdAt, statement: "En la conversación, Lucía explicó qué hace falsable a una hipótesis y la reformuló con métrica, umbral y plazo, con dos preguntas orientadoras del tutor.", studentStatement: "En la conversación explicaste qué hace comprobable a una hipótesis y la reformulaste con métrica, umbral y plazo, después de dos preguntas del tutor.", dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", proposed: "CONSISTENT", policyNotes: ["Evidencia consistente requiere al menos dos evidencias en dos experiencias distintas."], rationale: "Dos evidencias en la misma conversación, con asistencia media.", requiresReview: false, priority: "LOW", supports: [{ signal: sLC1 }, { signal: sLC1b }] });
  const iL5 = await seedInference({ run: lConvRun, at: lConvRun.createdAt, statement: "Por ahora, Lucía formula hipótesis falsables con guía; ella misma señala que le cuesta sin ayuda.", studentStatement: "En la conversación pudiste formular hipótesis con ayuda del tutor, y vos misma dijiste que todavía te cuesta sin guía.", dimension: "AUTONOMY", polarity: "DIFFICULTY", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia, con asistencia observada media.", requiresReview: true, priority: "LOW", supports: [{ signal: sLC2 }] });
  const iL4 = await seedInference({ run: lConvRun, at: lConvRun.createdAt, statement: "Aparecen dudas de Lucía sobre la propuesta de valor de su emprendimiento.", studentStatement: "En la conversación aparecieron dudas sobre tu propuesta de valor.", dimension: "COMPREHENSION", polarity: "DIFFICULTY", itemId: C2.id, support: "PARTIAL", rationale: "Una pregunta en la conversación.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sLC3 }], reviewStatus: "INCORRECT" });
  await seedFeedback({ run: run(lConvRun), at: addMinutes(lConvRun.createdAt, 1), viewed: true, summary: "En la conversación pasaste de una afirmación difícil de comprobar a una hipótesis con métrica, umbral y plazo, con ayuda de algunas preguntas del tutor. Explicarlo es un buen paso; falta ver cómo lo aplicás sola en una actividad.", inferenceIds: [iL3.id, iL5.id], evidenceIds: [lC1.id, lC2.id, lC3.id] });

  // ═════════════ JOAQUÍN ═════════════
  const jAnswers = {
    p1: "Familias jóvenes con chicos en edad escolar, porque compran mucho.",
    p2: "Si publicamos en Instagram vamos a conseguir clientes rápido.",
    p3: "Cantidad de seguidores nuevos.",
    p4: "No sé si el precio es razonable.",
  };
  const jBase = await seedSubmission({ courseId, studentId: joaquin.id, activity: baseline, answers: jAnswers, declaredAssistance: "NONE", confidence: "HIGH", at: daysAgo(12, 18) });
  const jBaseRun = await seedRun({ courseId, studentId: joaquin.id, experienceId: jBase.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(12, 18), 2) });
  const jB1 = await seedEvidence({ run: run(jBaseRun), kind: "DECISION", observation: "Eligió un segmento definido por edad y etapa familiar, justificado por volumen de compra.", content: jAnswers.p1, sourceText: jAnswers.p1, context: "Challenge inicial, consigna 1. Sin asistencia declarada.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 18), itemIds: [C1.id], promptKeys: ["p1"], submissionId: jBase.submission.id });
  const sJB1 = await seedSignal({ evidence: jB1, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C1.id, description: "Segmenta por un dato demográfico y volumen de compra, sin una necesidad que el servicio resuelva.", rationale: "«Compran mucho» no explica por qué elegirían viandas saludables." });
  const jB2 = await seedEvidence({ run: run(jBaseRun), kind: "HYPOTHESIS", observation: "Planteó una expectativa de resultado sin métrica, umbral ni plazo.", content: jAnswers.p2, sourceText: jAnswers.p2, context: "Challenge inicial, consigna 2. Sin asistencia declarada.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 18), itemIds: [C4.id], promptKeys: ["p2"], submissionId: jBase.submission.id });
  const jB3 = await seedEvidence({ run: run(jBaseRun), kind: "ANALYSIS", observation: "Eligió la cantidad de seguidores como dato para validar la hipótesis.", content: jAnswers.p3, sourceText: jAnswers.p3, context: "Challenge inicial, consigna 3.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 18), itemIds: [C5.id], promptKeys: ["p3"], submissionId: jBase.submission.id });
  const sJB2 = await seedSignal({ evidence: jB2, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, description: "Plantea una expectativa de resultado sin métrica, umbral ni plazo.", rationale: "No hay resultado que la refute." });
  const sJB3 = await seedSignal({ evidence: jB3, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C5.id, description: "Elige una métrica de vanidad (seguidores) que no conecta con la decisión de negocio.", rationale: "Seguidores no indica disposición a comprar." });
  await seedEvaluation({ run: run(jBaseRun), submissionId: jBase.submission.id, criterionId: R1.id, result: "DOES_NOT_MEET", rationale: "La hipótesis no define métrica, umbral ni plazo.", evidenceIds: [jB2.id], at: jBaseRun.createdAt });
  await seedEvaluation({ run: run(jBaseRun), submissionId: jBase.submission.id, criterionId: R2.id, result: "DOES_NOT_MEET", rationale: "El segmento se define por etapa familiar y volumen de compra, no por una necesidad.", evidenceIds: [jB1.id], at: jBaseRun.createdAt });
  const iJ0 = await seedInference({ run: jBaseRun, at: jBaseRun.createdAt, statement: "En el challenge inicial, Joaquín elige el segmento por etapa familiar y volumen de compra, sin vincularlo con una necesidad.", studentStatement: "Elegiste familias jóvenes porque compran mucho; todavía no aparece qué necesidad resolvería el servicio para ellas.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C1.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sJB1 }] });
  const iJ1 = await seedInference({ run: jBaseRun, at: jBaseRun.createdAt, statement: "En el challenge inicial, Joaquín formula la hipótesis como expectativa general («vamos a conseguir clientes rápido»), sin métrica, umbral ni plazo.", studentStatement: "En el challenge inicial tu hipótesis («vamos a conseguir clientes rápido») no define qué resultado la haría falsa.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sJB2 }] });
  const iJ2 = await seedInference({ run: jBaseRun, at: jBaseRun.createdAt, statement: "Joaquín elige como métrica un indicador de vanidad (seguidores) que no conecta con la decisión.", studentStatement: "Elegiste mirar seguidores nuevos; ese dato no te dice si alguien va a comprar.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C5.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "LOW", supports: [{ signal: sJB3 }] });
  await seedFeedback({ run: run(jBaseRun), at: addMinutes(jBaseRun.createdAt, 1), viewed: true, summary: "En el challenge inicial tu hipótesis y tu métrica quedaron generales: no queda claro qué resultado te haría cambiar de idea. Es un buen punto para practicar.", inferenceIds: [iJ0.id, iJ1.id, iJ2.id], evidenceIds: [jB1.id, jB2.id, jB3.id] });

  const jConv = await seedConversation({
    courseId,
    studentId: joaquin.id,
    title: "Hipótesis falsables",
    focusItemId: C4.id,
    start: daysAgo(9, 22),
    messages: [
      ["STUDENT", "¿Una hipótesis falsable es una que se puede demostrar que está mal?"],
      ["TUTOR", "Contame con tus palabras qué significaría «demostrar que está mal» en un negocio."],
      ["STUDENT", "Que antes de probar digo qué número tendría que ver. Por ejemplo, si vendo menos de 30 mates en un mes con el stand en la feria, la idea de vender en ferias no funciona."],
      ["TUTOR", "¿Y por qué es mejor plantearlo así que decir «en la feria se va a vender bien»?"],
      ["STUDENT", "Porque con la otra frase siempre puedo decir que fue mala suerte, en cambio con el número sé cuándo cambiar."],
    ],
  });
  const jm = jConv.messages;
  const jConvRun = await seedRun({ courseId, studentId: joaquin.id, experienceId: jConv.experience.id, source: "AI_CONVERSATION", at: addMinutes(daysAgo(9, 22), 18) });
  const jC1 = await seedEvidence({ run: run(jConvRun), kind: "EXPLANATION", observation: "Explicó la falsabilidad con un ejemplo de su propio emprendimiento.", content: "antes de probar digo qué número tendría que ver. Por ejemplo, si vendo menos de 30 mates en un mes con el stand en la feria, la idea de vender en ferias no funciona.", sourceText: jm[2].content, context: "Respuesta a una pregunta orientadora del tutor.", assistance: "LOW", assistanceSource: "OBSERVED", at: jm[2].createdAt, itemIds: [C4.id], messageIds: [jm[1].id, jm[2].id] });
  const jC2 = await seedEvidence({ run: run(jConvRun), kind: "JUSTIFICATION", observation: "Justificó por qué una hipótesis no falsable impide aprender.", content: jm[4].content, sourceText: jm[4].content, context: "Respuesta a una pregunta del tutor.", assistance: "LOW", assistanceSource: "OBSERVED", at: jm[4].createdAt, itemIds: [C4.id], messageIds: [jm[3].id, jm[4].id] });
  const sJC1 = await seedSignal({ evidence: jC1, dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, description: "Explica la falsabilidad con métrica, umbral y plazo en un caso propio.", rationale: "Define el resultado que refutaría la idea." });
  const sJC2 = await seedSignal({ evidence: jC2, dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, description: "Explica por qué una hipótesis no falsable impide aprender.", rationale: "Distingue la afirmación vaga de la falsable." });
  const iJ3 = await seedInference({ run: jConvRun, at: jConvRun.createdAt, statement: "En la conversación, Joaquín explica qué hace falsable a una hipótesis y por qué sirve, con un ejemplo de su emprendimiento.", studentStatement: "En la conversación explicaste con un ejemplo propio qué hace comprobable a una hipótesis y por qué sirve.", dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", proposed: "CONSISTENT", policyNotes: ["Evidencia consistente requiere al menos dos evidencias en dos experiencias distintas."], rationale: "Dos evidencias de una misma conversación con poca asistencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sJC1 }, { signal: sJC2 }], reviewStatus: "PARTIALLY_CORRECT" });
  await seedFeedback({ run: run(jConvRun), at: addMinutes(jConvRun.createdAt, 1), viewed: true, summary: "Explicaste muy claro por qué conviene definir antes qué número te haría cambiar de idea. Falta verlo aplicado en una actividad.", inferenceIds: [iJ3.id], evidenceIds: [jC1.id, jC2.id], nextSteps: [{ type: "REVIEW_CONCEPT", title: "Revisar cómo diseñar una prueba con comparación", description: "Repasá el diseño de experimentos simples: qué comparás contra qué.", itemId: O3.id }] });

  // ═════════════ VALENTINA ═════════════
  const vAnswers = {
    p1: "Elegiría personas que entrenan en gimnasios y quieren comer sano pero no tienen tiempo de cocinar: tienen una necesidad concreta y ya gastan en su salud.",
    p2: "Los clientes van a preferir nuestras viandas porque son más sanas.",
    p3: "Las reseñas que dejen.",
    p4: "No sé cuánto cuesta producir cada vianda.",
  };
  const vBase = await seedSubmission({ courseId, studentId: valentina.id, activity: baseline, answers: vAnswers, declaredAssistance: "NONE", at: daysAgo(12, 16) });
  const vBaseRun = await seedRun({ courseId, studentId: valentina.id, experienceId: vBase.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(12, 16), 2) });
  const vB1 = await seedEvidence({ run: run(vBaseRun), kind: "DECISION", observation: "Eligió un segmento definido por una necesidad y un comportamiento (entrenan, sin tiempo para cocinar).", content: vAnswers.p1, sourceText: vAnswers.p1, context: "Challenge inicial, consigna 1. Sin asistencia declarada.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 16), itemIds: [C1.id, O1.id], promptKeys: ["p1"], submissionId: vBase.submission.id });
  const vB2 = await seedEvidence({ run: run(vBaseRun), kind: "HYPOTHESIS", observation: "Formuló la hipótesis como preferencia general, sin métrica ni plazo.", content: vAnswers.p2, sourceText: vAnswers.p2, context: "Challenge inicial, consigna 2.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 16), itemIds: [C4.id], promptKeys: ["p2"], submissionId: vBase.submission.id });
  const sVB1 = await seedSignal({ evidence: vB1, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C1.id, description: "Segmenta por necesidad y comportamiento (entrenan, sin tiempo para cocinar).", rationale: "El criterio se vincula con el problema que resuelve la oferta." });
  const sVB2 = await seedSignal({ evidence: vB2, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, description: "Formula la hipótesis como preferencia general no verificable.", rationale: "No define métrica, umbral ni plazo." });
  const iV1 = await seedInference({ run: vBaseRun, at: vBaseRun.createdAt, statement: "Valentina segmenta por necesidad y comportamiento en el challenge inicial.", studentStatement: "En el challenge inicial elegiste el segmento por una necesidad concreta y un comportamiento.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C1.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sVB1 }] });
  const iV2 = await seedInference({ run: vBaseRun, at: vBaseRun.createdAt, statement: "En el challenge inicial, la hipótesis de Valentina expresa una preferencia general sin métrica, umbral ni plazo.", studentStatement: "Tu hipótesis («van a preferir nuestras viandas») todavía no define cómo comprobarla.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sVB2 }] });
  await seedFeedback({ run: run(vBaseRun), at: addMinutes(vBaseRun.createdAt, 1), viewed: true, summary: "Elegiste un segmento muy bien definido por su necesidad. La hipótesis quedó general: todavía no dice qué resultado te haría cambiar de idea.", contrast: "Mencionaste que los números te cuestan; en esta actividad la parte cuantitativa (métrica y umbral) fue la menos desarrollada, aunque es una sola evidencia.", inferenceIds: [iV1.id, iV2.id], evidenceIds: [vB1.id, vB2.id] });

  const vConv = await seedConversation({
    courseId,
    studentId: valentina.id,
    title: "Segmentación de mercado",
    focusItemId: C1.id,
    start: daysAgo(9, 15),
    messages: [
      ["STUDENT", "Quiero practicar segmentación con un ejemplo distinto al del challenge."],
      ["TUTOR", "Dale. Imaginá una app para aprender idiomas. ¿Qué segmento elegirías para empezar y con qué criterio?"],
      ["STUDENT", "Elegiría mujeres de 25 a 35 años de nivel socioeconómico medio-alto, porque son las que más gastan en educación."],
      ["TUTOR", "¿Ese criterio te dice algo sobre por qué querrían aprender un idioma?"],
      ["STUDENT", "No mucho... también podría ser gente que tiene que viajar por trabajo. Igual una hipótesis falsable sería: el 15% de los que prueban la app gratis pagan el plan en un mes; si son menos del 5%, cambio de segmento."],
    ],
  });
  const vm = vConv.messages;
  const vConvRun = await seedRun({ courseId, studentId: valentina.id, experienceId: vConv.experience.id, source: "AI_CONVERSATION", at: addMinutes(daysAgo(9, 15), 16) });
  const vC1 = await seedEvidence({ run: run(vConvRun), kind: "DECISION", observation: "Ante un caso nuevo, eligió un segmento definido solo por edad, género y nivel socioeconómico.", content: vm[2].content, sourceText: vm[2].content, context: "Caso nuevo propuesto por el tutor (app de idiomas); primera respuesta, con una pregunta orientadora.", assistance: "LOW", assistanceSource: "OBSERVED", at: vm[2].createdAt, itemIds: [C1.id], messageIds: [vm[1].id, vm[2].id] });
  const vC2 = await seedEvidence({ run: run(vConvRun), kind: "EXPLANATION", observation: "Formuló una hipótesis con métrica, umbral y plazo para el caso nuevo.", content: "una hipótesis falsable sería: el 15% de los que prueban la app gratis pagan el plan en un mes; si son menos del 5%, cambio de segmento.", sourceText: vm[4].content, context: "Después de que el tutor cuestionara su criterio de segmentación.", assistance: "LOW", assistanceSource: "OBSERVED", at: vm[4].createdAt, itemIds: [C4.id], messageIds: [vm[3].id, vm[4].id] });
  const sVC1 = await seedSignal({ evidence: vC1, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C1.id, description: "Segmenta solo por variables demográficas y de ingreso, sin vincularlas con una necesidad.", rationale: "El criterio no explica por qué ese grupo necesitaría el producto." });
  const sVC2 = await seedSignal({ evidence: vC2, dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, description: "Formula correctamente una hipótesis falsable en un caso nuevo.", rationale: "Incluye métrica, umbral y plazo." });
  const iV3 = await seedInference({ run: vConvRun, at: vConvRun.createdAt, statement: "Señales contradictorias sobre la aplicación de criterios de segmentación: en el challenge inicial Valentina segmentó por necesidad y comportamiento; en la conversación, ante un caso nuevo, usó solo criterios demográficos (y luego los cuestionó tras una pregunta del tutor).", studentStatement: "En el challenge inicial segmentaste por necesidades; en la conversación, con un caso nuevo, empezaste por edad e ingreso. Todavía no está claro cuál refleja mejor cómo lo aplicás.", dimension: "APPLICATION", polarity: "MIXED", itemId: C1.id, support: "CONTRADICTORY", proposed: "PARTIAL", policyNotes: ["Existe evidencia en sentido opuesto: se marca como señales contradictorias."], contradictionNote: "Conviene revisar si la diferencia se explica por el contexto (caso nuevo, conversación exploratoria) o si el criterio todavía no está consolidado.", rationale: "Dos evidencias en experiencias distintas apuntan en direcciones opuestas.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sVC1 }, { signal: sVB1, relation: "CONTRADICTS" }], supersedesId: iV1.id, teacherAction: { type: "ASK_STUDENT", description: "Preguntarle a Valentina qué criterio usaría hoy para segmentar un caso nuevo y por qué." } });
  const iV4 = await seedInference({ run: vConvRun, at: vConvRun.createdAt, statement: "En la conversación, Valentina formula una hipótesis falsable (métrica, umbral y plazo) para un caso nuevo.", studentStatement: "En la conversación formulaste una hipótesis comprobable para un caso nuevo, con métrica, umbral y plazo.", dimension: "COMPREHENSION", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia de conversación.", requiresReview: false, priority: "LOW", supports: [{ signal: sVC2 }] });
  await db.studentResponse.create({ data: { inferenceId: iV3.id, studentId: valentina.id, stance: "MISSING_CONTEXT", note: "En la conversación estaba probando un ejemplo que me dio el tutor, no era mi propuesta. Igual me sirvió darme cuenta de que arranqué por edad.", createdAt: daysAgo(8, 20) } });
  await seedFeedback({ run: run(vConvRun), at: addMinutes(vConvRun.createdAt, 1), viewed: true, summary: "En la conversación formulaste una hipótesis comprobable para un caso nuevo. Para segmentar, en cambio, empezaste por edad e ingreso, distinto a lo que hiciste en el challenge: vale la pena mirarlo.", inferenceIds: [iV3.id, iV4.id], evidenceIds: [vC1.id, vC2.id], nextSteps: [{ type: "REFLECT", title: "Comparar tus dos segmentaciones", description: "Mirá qué criterio usaste en el challenge y cuál en la conversación. ¿Cuál elegirías hoy y por qué?", itemId: C1.id }] });

  // ═════════════ MATEO ═════════════
  const mAnswers = {
    p1: "Jóvenes de 18 a 30 años de Rosario, porque son los que más piden comida.",
    p2: "Si hacemos buena publicidad vamos a vender muchas viandas.",
    p3: "Las ventas.",
    p4: "La competencia de las apps de delivery.",
  };
  const mBase = await seedSubmission({ courseId, studentId: mateo.id, activity: baseline, answers: mAnswers, declaredAssistance: "NONE", at: daysAgo(11, 23) });
  const mBaseRun = await seedRun({ courseId, studentId: mateo.id, experienceId: mBase.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(11, 23), 2) });
  const mB1 = await seedEvidence({ run: run(mBaseRun), kind: "DECISION", observation: "Eligió un segmento definido solo por edad y ciudad.", content: mAnswers.p1, sourceText: mAnswers.p1, context: "Challenge inicial, consigna 1.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(11, 23), itemIds: [C1.id], promptKeys: ["p1"], submissionId: mBase.submission.id });
  const mB2 = await seedEvidence({ run: run(mBaseRun), kind: "HYPOTHESIS", observation: "Formuló la hipótesis condicionada a «buena publicidad», sin métrica, umbral ni plazo.", content: mAnswers.p2, sourceText: mAnswers.p2, context: "Challenge inicial, consigna 2.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(11, 23), itemIds: [C4.id], promptKeys: ["p2"], submissionId: mBase.submission.id });
  const sMB1 = await seedSignal({ evidence: mB1, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C1.id, description: "Segmenta solo por edad, sin necesidad ni comportamiento.", rationale: "El criterio no se vincula con el problema." });
  const sMB2 = await seedSignal({ evidence: mB2, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, description: "Formula la hipótesis sin métrica, umbral ni plazo.", rationale: "«Vender muchas» no puede resultar falsa." });
  await seedEvaluation({ run: run(mBaseRun), submissionId: mBase.submission.id, criterionId: R1.id, result: "DOES_NOT_MEET", rationale: "La hipótesis no es falsable.", evidenceIds: [mB2.id], at: mBaseRun.createdAt });
  await seedEvaluation({ run: run(mBaseRun), submissionId: mBase.submission.id, criterionId: R2.id, result: "DOES_NOT_MEET", rationale: "Segmenta solo por edad.", evidenceIds: [mB1.id], at: mBaseRun.createdAt });
  const iM1 = await seedInference({ run: mBaseRun, at: mBaseRun.createdAt, statement: "En el challenge inicial, Mateo segmenta solo por edad, sin vincular el segmento con una necesidad.", studentStatement: "En el challenge inicial elegiste el segmento por edad; todavía no aparece qué necesidad tienen esas personas.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C1.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sMB1 }] });
  const iM2 = await seedInference({ run: mBaseRun, at: mBaseRun.createdAt, statement: "La hipótesis de Mateo en el challenge inicial no es falsable (sin métrica, umbral ni plazo).", studentStatement: "Tu hipótesis («vamos a vender muchas viandas») no define qué resultado la haría falsa.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sMB2 }], reviewStatus: "CONFIRMED" });
  await seedFeedback({ run: run(mBaseRun), at: addMinutes(mBaseRun.createdAt, 1), viewed: true, summary: "En el challenge inicial el segmento quedó definido solo por edad y la hipótesis no dice qué resultado te haría cambiar de idea.", contrast: "Mencionaste que te cuesta explicar por escrito por qué decidís algo; en esta actividad las justificaciones fueron breves, así que es difícil saber qué pensaste.", inferenceIds: [iM1.id, iM2.id], evidenceIds: [mB1.id, mB2.id] });

  const mConv = await seedConversation({
    courseId,
    studentId: mateo.id,
    title: "Problema vs. solución",
    focusItemId: C3.id,
    start: daysAgo(8, 21),
    messages: [
      ["STUDENT", "No entiendo la diferencia entre problema y solución. Para mí el problema es que no hay una app de viandas buena."],
      ["TUTOR", "Interesante. Si la app existiera, ¿qué le pasaría a la persona que hoy no la tiene? ¿Qué le cuesta hoy?"],
      ["STUDENT", "Y... que tiene que pedir por otras apps. El problema es que falta la app."],
      ["TUTOR", "Fijate que «falta la app» describe la solución que imaginás. Probá describir la dificultad de la persona sin mencionar ninguna app."],
      ["STUDENT", "¿Que no tiene tiempo para cocinar sano al mediodía?"],
    ],
  });
  const mm = mConv.messages;
  const mConvRun = await seedRun({ courseId, studentId: mateo.id, experienceId: mConv.experience.id, source: "AI_CONVERSATION", at: addMinutes(daysAgo(8, 21), 16) });
  const mC1 = await seedEvidence({ run: run(mConvRun), kind: "ERROR", observation: "Definió el problema como la ausencia de su propia solución.", content: "Para mí el problema es que no hay una app de viandas buena.", sourceText: mm[0].content, context: "Inicio de la conversación, sin ayuda previa.", assistance: "NONE", assistanceSource: "OBSERVED", at: mm[0].createdAt, itemIds: [C3.id], messageIds: [mm[0].id] });
  const mC2 = await seedEvidence({ run: run(mConvRun), kind: "ATTEMPT", observation: "Después de una pregunta orientadora, repitió que el problema es que falta la app.", content: "El problema es que falta la app.", sourceText: mm[2].content, context: "Tras una pregunta orientadora del tutor.", assistance: "LOW", assistanceSource: "OBSERVED", at: mm[2].createdAt, itemIds: [C3.id], messageIds: [mm[1].id, mm[2].id] });
  const mC3 = await seedEvidence({ run: run(mConvRun), kind: "ATTEMPT", observation: "Con una reformulación explícita del tutor, describió una dificultad del usuario.", content: mm[4].content, sourceText: mm[4].content, context: "El tutor le indicó explícitamente que «falta la app» es una solución.", assistance: "HIGH", assistanceSource: "OBSERVED", at: mm[4].createdAt, itemIds: [C3.id], messageIds: [mm[3].id, mm[4].id] });
  const sMC1 = await seedSignal({ evidence: mC1, dimension: "COMPREHENSION", polarity: "DIFFICULTY", itemId: C3.id, description: "Define el problema como la ausencia de su solución.", rationale: "Confunde el problema del cliente con la solución imaginada." });
  const sMC2 = await seedSignal({ evidence: mC2, dimension: "COMPREHENSION", polarity: "DIFFICULTY", itemId: C3.id, description: "Mantiene la confusión entre problema y solución tras una pista.", rationale: "Repite la misma formulación." });
  const sMC3 = await seedSignal({ evidence: mC3, dimension: "AUTONOMY", polarity: "DIFFICULTY", itemId: C3.id, description: "Llega a describir el problema solo con una reformulación explícita del tutor.", rationale: "Asistencia alta previa." });
  const iM3 = await seedInference({ run: mConvRun, at: mConvRun.createdAt, statement: "En la conversación, Mateo describió el problema como la falta de su propia solución («falta la app»); solo con una reformulación del tutor llegó a una dificultad del usuario.", studentStatement: "En la conversación describiste el problema como «falta la app», que es una solución; con ayuda del tutor llegaste a una dificultad real de las personas.", dimension: "COMPREHENSION", polarity: "DIFFICULTY", itemId: C3.id, support: "PARTIAL", proposed: "CONSISTENT", policyNotes: ["Evidencia consistente requiere al menos dos evidencias en dos experiencias distintas."], rationale: "Dos evidencias en la misma conversación.", requiresReview: true, priority: "HIGH", supports: [{ signal: sMC1 }, { signal: sMC2 }, { signal: sMC3 }], teacherAction: { type: "ASK_STUDENT", description: "Pedirle a Mateo en clase que describa el problema de un caso sin mencionar ninguna solución." } });
  await seedFeedback({ run: run(mConvRun), at: addMinutes(mConvRun.createdAt, 1), viewed: false, summary: "En la conversación costó separar el problema de la solución: «falta la app» describe lo que querés construir, no lo que le pasa a la persona. Con una pista llegaste a una dificultad real; practicarlo sin ayuda es el próximo paso.", inferenceIds: [iM3.id], evidenceIds: [mC1.id, mC2.id, mC3.id], nextSteps: [{ type: "PRACTICE_WITH_TUTOR", title: "Describir problemas sin mencionar soluciones", description: "Pedile al tutor tres casos y escribí el problema de cada uno sin nombrar ningún producto.", itemId: C3.id }] });

  // ═════════════ CAMILA ═════════════
  const cAnswers = {
    p1: "Clientes del banco de entre 30 y 50 años con ingresos altos.",
    p2: "Al menos 50 suscripciones pagas en las dos semanas de prueba; si son menos de 20, no sigo.",
    p3: "Conversión de prueba gratuita a suscripción y costo de adquisición por cliente comparado con el ticket mensual.",
    p4: "Que el canal de folletos alcance.",
  };
  const cBase = await seedSubmission({ courseId, studentId: camila.id, activity: baseline, answers: cAnswers, declaredAssistance: "NONE", confidence: "HIGH", at: daysAgo(12, 13) });
  const cBaseRun = await seedRun({ courseId, studentId: camila.id, experienceId: cBase.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(12, 13), 2) });
  const cB1 = await seedEvidence({ run: run(cBaseRun), kind: "DECISION", observation: "Eligió un segmento definido por edad e ingreso.", content: cAnswers.p1, sourceText: cAnswers.p1, context: "Challenge inicial, consigna 1.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 13), itemIds: [C1.id], promptKeys: ["p1"], submissionId: cBase.submission.id });
  const cB2 = await seedEvidence({ run: run(cBaseRun), kind: "HYPOTHESIS", observation: "Formuló una hipótesis con métrica, umbral y plazo.", content: cAnswers.p2, sourceText: cAnswers.p2, context: "Challenge inicial, consigna 2.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 13), itemIds: [C4.id], promptKeys: ["p2"], submissionId: cBase.submission.id });
  const cB3 = await seedEvidence({ run: run(cBaseRun), kind: "ANALYSIS", observation: "Combinó conversión y costo de adquisición para decidir.", content: cAnswers.p3, sourceText: cAnswers.p3, context: "Challenge inicial, consigna 3.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(12, 13), itemIds: [C5.id], promptKeys: ["p3"], submissionId: cBase.submission.id });
  const sCB1 = await seedSignal({ evidence: cB1, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C1.id, description: "Segmenta por edad e ingreso sin conectar con una necesidad.", rationale: "Criterio demográfico." });
  const sCB2 = await seedSignal({ evidence: cB2, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, description: "Hipótesis con métrica, umbral y plazo.", rationale: "Define el resultado que la refuta." });
  const sCB3 = await seedSignal({ evidence: cB3, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C5.id, description: "Combina conversión y costo de adquisición para decidir.", rationale: "Conecta métricas con viabilidad." });
  await seedEvaluation({ run: run(cBaseRun), submissionId: cBase.submission.id, criterionId: R1.id, result: "MEETS", rationale: "Métrica (suscripciones pagas), umbral (50/20) y plazo (dos semanas).", evidenceIds: [cB2.id], at: cBaseRun.createdAt });
  await seedEvaluation({ run: run(cBaseRun), submissionId: cBase.submission.id, criterionId: R2.id, result: "DOES_NOT_MEET", rationale: "Segmento solo demográfico.", evidenceIds: [cB1.id], at: cBaseRun.createdAt });
  const iC1 = await seedInference({ run: cBaseRun, at: cBaseRun.createdAt, statement: "En el challenge inicial, Camila segmenta por edad e ingreso, sin vincular el segmento con una necesidad.", studentStatement: "En el challenge inicial elegiste el segmento por edad e ingreso; no aparece qué necesidad tienen.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: C1.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sCB1 }], reviewStatus: "NEEDS_CONTEXT" });
  const iC2 = await seedInference({ run: cBaseRun, at: cBaseRun.createdAt, statement: "Camila formula una hipótesis falsable y elige métricas conectadas con la decisión.", studentStatement: "Tu hipótesis tiene métrica, umbral y plazo, y elegiste métricas que sirven para decidir.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", rationale: "Una experiencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sCB2 }, { signal: sCB3 }] });
  await seedFeedback({ run: run(cBaseRun), at: addMinutes(cBaseRun.createdAt, 1), viewed: true, summary: "Tu hipótesis y tus métricas están muy bien planteadas para decidir. El segmento quedó definido por edad e ingreso: falta decir qué necesidad tienen esas personas.", contrast: "Dijiste que te manejás bien con datos, y en esta actividad la parte de métricas fue la más sólida.", inferenceIds: [iC1.id, iC2.id], evidenceIds: [cB1.id, cB2.id, cB3.id] });

  // ═════════════ SOFÍA ═════════════
  const sAnswers = {
    p1: "Productores y empleados rurales de la zona de Casilda que trabajan jornadas largas lejos de un comedor: necesitan comida que aguante el día y hoy dependen de lo que traen de casa.",
    p2: "Al menos 30 de los 120 empleados de las tres empresas agrícolas con las que hablamos contratan el plan semanal en las primeras dos semanas; si son menos de 10, descarto este segmento.",
    p3: "Porcentaje de contratación del plan semanal y cuántos repiten la segunda semana.",
    p4: "La logística de entrega en zonas rurales.",
  };
  const sBase = await seedSubmission({ courseId, studentId: sofia.id, activity: baseline, answers: sAnswers, declaredAssistance: "NONE", confidence: "MEDIUM", at: daysAgo(11, 20) });
  const sBaseRun = await seedRun({ courseId, studentId: sofia.id, experienceId: sBase.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(11, 20), 2) });
  const sB1 = await seedEvidence({ run: run(sBaseRun), kind: "DECISION", observation: "Eligió un segmento definido por una necesidad y una condición de trabajo concreta.", content: sAnswers.p1, sourceText: sAnswers.p1, context: "Challenge inicial, consigna 1.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(11, 20), itemIds: [C1.id], promptKeys: ["p1"], submissionId: sBase.submission.id });
  const sB2 = await seedEvidence({ run: run(sBaseRun), kind: "HYPOTHESIS", observation: "Formuló una hipótesis con métrica, umbral y plazo.", content: sAnswers.p2, sourceText: sAnswers.p2, context: "Challenge inicial, consigna 2.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(11, 20), itemIds: [C4.id], promptKeys: ["p2"], submissionId: sBase.submission.id });
  const sSB1 = await seedSignal({ evidence: sB1, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C1.id, description: "Segmenta por necesidad y condiciones de trabajo.", rationale: "El criterio explica por qué necesitarían el servicio." });
  const sSB2 = await seedSignal({ evidence: sB2, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, description: "Hipótesis con métrica, umbral y plazo.", rationale: "Define el resultado que la refuta." });
  await seedEvaluation({ run: run(sBaseRun), submissionId: sBase.submission.id, criterionId: R1.id, result: "MEETS", rationale: "Métrica, umbral y plazo explícitos.", evidenceIds: [sB2.id], at: sBaseRun.createdAt });
  await seedEvaluation({ run: run(sBaseRun), submissionId: sBase.submission.id, criterionId: R2.id, result: "MEETS", rationale: "Segmenta por necesidad.", evidenceIds: [sB1.id], at: sBaseRun.createdAt });
  const iS1 = await seedInference({ run: sBaseRun, at: sBaseRun.createdAt, statement: "Sofía formula una hipótesis falsable (métrica, umbral y plazo) en el challenge inicial.", studentStatement: "Tu hipótesis del challenge inicial tiene métrica, umbral y plazo.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sSB2 }] });
  const iS2 = await seedInference({ run: sBaseRun, at: sBaseRun.createdAt, statement: "Sofía segmenta por necesidad y condiciones de trabajo.", studentStatement: "Elegiste el segmento por una necesidad concreta de esas personas.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C1.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sSB1 }] });
  await seedFeedback({ run: run(sBaseRun), at: addMinutes(sBaseRun.createdAt, 1), viewed: true, summary: "Tu segmento y tu hipótesis están bien conectados con un problema real del sector que conocés. Sería interesante ver cómo lo aplicás en un contexto distinto.", inferenceIds: [iS1.id, iS2.id], evidenceIds: [sB1.id, sB2.id] });

  // ═════════════ REVISIONES DOCENTES ═════════════
  await db.teacherReview.createMany({
    data: [
      { inferenceId: iM2.id, teacherId: teacher.id, verdict: "CONFIRMED", comment: "Coincide con lo que vi en clase.", createdAt: daysAgo(8, 9) },
      { inferenceId: iC1.id, teacherId: teacher.id, verdict: "NEEDS_CONTEXT", comment: "Camila entregó desde el celular durante su turno en el banco. Lo conversamos y oralmente justificó el segmento por necesidad.", createdAt: daysAgo(8, 9, 10) },
      { inferenceId: iJ3.id, teacherId: teacher.id, verdict: "PARTIALLY_CORRECT", comment: "Lo explica bien, pero en clase todavía mezcla hipótesis con objetivos de venta.", createdAt: daysAgo(8, 9, 20) },
      { inferenceId: iL4.id, teacherId: teacher.id, verdict: "INCORRECT", comment: "La pregunta era sobre hipótesis, no sobre propuesta de valor: el vínculo con la currícula está mal.", createdAt: daysAgo(8, 9, 30) },
    ],
  });

  // ═════════════ INTERVENCIÓN ═════════════
  const intervention = await db.intervention.create({
    data: {
      courseId,
      teacherId: teacher.id,
      type: "PRACTICE",
      description:
        "En la clase del jueves dedicamos 20 minutos a convertir afirmaciones en hipótesis falsables (métrica + umbral + plazo) en vez de repetir la definición, y publiqué una práctica en otro contexto (logística).",
      messageToStudents: "Revisá cómo armamos hipótesis en clase y resolvé la práctica de logística: es un contexto distinto para aplicar lo mismo.",
      activityId: practice.id,
      curriculumItemId: C4.id,
      insightKey: `gap:${C4.id}`,
      occurredAt: daysAgo(7, 19),
      createdAt: daysAgo(7, 19),
      targets: { create: [lucia.id, joaquin.id, valentina.id].map((studentId) => ({ studentId })) },
    },
  });
  for (const s of [lucia, joaquin, valentina]) {
    await db.suggestedAction.create({
      data: {
        courseId,
        studentId: s.id,
        audience: "STUDENT",
        source: "TEACHER",
        type: "TRY_ACTIVITY",
        title: `Tu docente te propone: ${practice.title}`,
        description: "Revisá cómo armamos hipótesis en clase y resolvé la práctica de logística: es un contexto distinto para aplicar lo mismo.",
        activityId: practice.id,
        curriculumItemId: C4.id,
        interventionId: intervention.id,
        status: s.id === valentina.id ? "OPEN" : "DONE",
        completedAt: s.id === valentina.id ? null : daysAgo(3),
        createdAt: daysAgo(7, 19),
      },
    });
  }

  // ═════════════ NUEVA EVIDENCIA POSTERIOR ═════════════
  // Lucía: mejora y primera señal de transferencia.
  const lpAnswers = {
    p1: "Si ofrecemos franjas de entrega de una hora en Fisherton, al menos el 25% de los clientes que hoy compran con envío estándar elige la franja paga en las primeras tres semanas. Si es menos del 10%, la idea no se sostiene.",
    p2: "Lo ofrecería solo en un barrio durante tres semanas, con el mismo precio que el competidor, y compararía contra otro barrio parecido donde no se ofrece.",
    p3: "Si menos del 10% elige la franja o si la mayoría la elige solo cuando es gratis.",
  };
  const lPrac = await seedSubmission({ courseId, studentId: lucia.id, activity: practice, answers: lpAnswers, declaredAssistance: "NONE", confidence: "MEDIUM", at: daysAgo(3, 20) });
  const lPracRun = await seedRun({ courseId, studentId: lucia.id, experienceId: lPrac.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(3, 20), 2) });
  const lP1 = await seedEvidence({ run: run(lPracRun), kind: "HYPOTHESIS", observation: "Formuló una hipótesis con métrica, umbral y plazo en un contexto de logística.", content: lpAnswers.p1, sourceText: lpAnswers.p1, context: "Práctica en logística (contexto distinto al gastronómico), consigna 1. Sin asistencia declarada ni consultas al tutor.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(3, 20), itemIds: [C4.id, O2.id], promptKeys: ["p1"], submissionId: lPrac.submission.id });
  const lP2 = await seedEvidence({ run: run(lPracRun), kind: "DECISION", observation: "Diseñó una prueba acotada con un barrio de comparación.", content: lpAnswers.p2, sourceText: lpAnswers.p2, context: "Práctica en logística, consigna 2.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(3, 20), itemIds: [O3.id], promptKeys: ["p2"], submissionId: lPrac.submission.id });
  const sLP1 = await seedSignal({ evidence: lP1, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, description: "Formula una hipótesis falsable con métrica, umbral y plazo sin ayuda.", rationale: "Cumple los tres elementos." });
  const sLP1t = await seedSignal({ evidence: lP1, dimension: "TRANSFER", polarity: "STRENGTH", itemId: C4.id, description: "Aplica la estructura de hipótesis en logística, un contexto distinto al gastronómico.", rationale: "Contexto diferente al declarado y al del challenge inicial." });
  const sLP1a = await seedSignal({ evidence: lP1, dimension: "AUTONOMY", polarity: "STRENGTH", itemId: C4.id, description: "Resuelve sin asistencia declarada ni consultas al tutor.", rationale: "Asistencia declarada: ninguna." });
  const sLP2 = await seedSignal({ evidence: lP2, dimension: "APPLICATION", polarity: "STRENGTH", itemId: O3.id, description: "Diseña la prueba con un grupo de comparación.", rationale: "Compara contra un barrio parecido." });
  await seedEvaluation({ run: run(lPracRun), submissionId: lPrac.submission.id, criterionId: R1.id, result: "MEETS", rationale: "Métrica (porcentaje que elige la franja), umbral (25%/10%) y plazo (tres semanas).", evidenceIds: [lP1.id], at: lPracRun.createdAt });
  const iL6 = await seedInference({ run: lPracRun, at: lPracRun.createdAt, statement: "Hace dos semanas la hipótesis de Lucía no era verificable; en la práctica de logística formuló una hipótesis falsable con métrica, umbral y plazo, sin asistencia.", studentStatement: "En el challenge inicial tu hipótesis no se podía comprobar; en la práctica de logística formulaste una con métrica, umbral y plazo, sin ayuda.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia de aplicación posterior a la intervención; muestra mejora respecto de la anterior.", requiresReview: false, priority: "LOW", supports: [{ signal: sLP1 }], supersedesId: iL1.id });
  const iL7 = await seedInference({ run: lPracRun, at: lPracRun.createdAt, statement: "Aparece una primera señal de transferencia: Lucía aplicó la estructura de hipótesis en logística, un contexto distinto al gastronómico que conoce.", studentStatement: "Aplicaste lo mismo en un contexto distinto al tuyo (logística). Es una primera señal: conviene ver si se repite.", dimension: "TRANSFER", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", rationale: "Una sola evidencia de transferencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sLP1t }] });
  const iL8 = await seedInference({ run: lPracRun, at: lPracRun.createdAt, statement: "En la conversación Lucía necesitó guía para formular hipótesis; en la práctica lo hizo sin asistencia declarada.", studentStatement: "En la conversación necesitaste guía; en la práctica formulaste la hipótesis sin ayuda.", dimension: "AUTONOMY", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia sin asistencia, posterior a una con asistencia media.", requiresReview: false, priority: "LOW", supports: [{ signal: sLP1a }], supersedesId: iL5.id });
  const iL9 = await seedInference({ run: lPracRun, at: lPracRun.createdAt, statement: "Lucía diseña una prueba acotada con un grupo de comparación.", studentStatement: "Diseñaste una prueba acotada y con un barrio de comparación.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: O3.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sLP2 }] });
  await seedFeedback({
    run: run(lPracRun),
    at: addMinutes(lPracRun.createdAt, 1),
    viewed: false,
    summary: "En la práctica de logística formulaste una hipótesis comprobable, con métrica, umbral y plazo, y la diseñaste con un barrio de comparación, sin ayuda. Respecto del challenge inicial aparece una mejora clara; como es una sola actividad, conviene ver si se repite.",
    contrast: "Al comenzar dijiste que te cuesta trabajar con datos. En las dos actividades elegiste métricas y umbrales concretos para decidir: todavía son pocas evidencias, pero apuntan en otra dirección que tu percepción inicial.",
    inferenceIds: [iL6.id, iL7.id, iL8.id, iL9.id],
    evidenceIds: [lP1.id, lP2.id],
    nextSteps: [{ type: "PRACTICE_WITH_TUTOR", title: "Probar la hipótesis de suscripción de tu emprendimiento", description: "Con el tutor, escribí la hipótesis sobre renovaciones de la suscripción y cómo la probarías.", itemId: C4.id }],
  });

  // Joaquín: mejora parcial (incorpora métrica y umbral, falta plazo).
  const jpAnswers = {
    p1: "Si ofrecemos la franja de una hora, al menos el 20% de los pedidos la va a elegir.",
    p2: "Probaría en toda la ciudad y vería cuántos la eligen.",
    p3: "Si nadie la elige.",
  };
  const jPrac = await seedSubmission({ courseId, studentId: joaquin.id, activity: practice, answers: jpAnswers, declaredAssistance: "TUTOR_ONLY", assistanceNote: "Le pregunté al tutor qué era el plazo.", at: daysAgo(2, 22) });
  const jPracRun = await seedRun({ courseId, studentId: joaquin.id, experienceId: jPrac.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(2, 22), 2) });
  const jP1 = await seedEvidence({ run: run(jPracRun), kind: "HYPOTHESIS", observation: "Formuló una hipótesis con métrica y umbral, sin plazo.", content: jpAnswers.p1, sourceText: jpAnswers.p1, context: "Práctica en logística, consigna 1. Asistencia declarada: consultó al tutor.", assistance: "LOW", assistanceSource: "DECLARED", assistanceNote: "Le pregunté al tutor qué era el plazo.", at: daysAgo(2, 22), itemIds: [C4.id], promptKeys: ["p1"], submissionId: jPrac.submission.id });
  const jP2 = await seedEvidence({ run: run(jPracRun), kind: "DECISION", observation: "Propuso probar en toda la ciudad sin grupo de comparación.", content: jpAnswers.p2, sourceText: jpAnswers.p2, context: "Práctica en logística, consigna 2.", assistance: "LOW", assistanceSource: "DECLARED", at: daysAgo(2, 22), itemIds: [O3.id], promptKeys: ["p2"], submissionId: jPrac.submission.id });
  const sJP1 = await seedSignal({ evidence: jP1, dimension: "APPLICATION", polarity: "MIXED", itemId: C4.id, description: "Incluye métrica y umbral, pero no define plazo.", rationale: "Mejora parcial respecto de la hipótesis anterior." });
  const sJP2 = await seedSignal({ evidence: jP2, dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: O3.id, description: "Diseña la prueba sin grupo de comparación ni recorte.", rationale: "No permite atribuir el resultado." });
  await seedEvaluation({ run: run(jPracRun), submissionId: jPrac.submission.id, criterionId: R1.id, result: "PARTIALLY_MEETS", rationale: "Tiene métrica y umbral; falta el plazo.", evidenceIds: [jP1.id], at: jPracRun.createdAt });
  const iJ4 = await seedInference({ run: jPracRun, at: jPracRun.createdAt, statement: "Respecto del challenge inicial, Joaquín incorporó métrica y umbral a su hipótesis; todavía falta el plazo y el diseño de la prueba no permite comparar.", studentStatement: "Comparado con el challenge inicial, tu hipótesis ahora tiene métrica y umbral; falta definir en qué plazo la comprobás.", dimension: "APPLICATION", polarity: "MIXED", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia posterior a la intervención; mejora parcial.", requiresReview: true, priority: "MEDIUM", supports: [{ signal: sJP1 }], supersedesId: iJ1.id, teacherAction: { type: "ASSIGN_PRACTICE", description: "Proponerle a Joaquín reescribir su hipótesis agregando el plazo y un grupo de comparación." } });
  const iJ5 = await seedInference({ run: jPracRun, at: jPracRun.createdAt, statement: "El diseño de prueba de Joaquín no incluye comparación, por lo que no permitiría atribuir el resultado.", studentStatement: "Tu prueba se hace en toda la ciudad sin un grupo para comparar; así es difícil saber si el resultado se debe a la franja.", dimension: "APPLICATION", polarity: "DIFFICULTY", itemId: O3.id, support: "PARTIAL", rationale: "Una evidencia.", requiresReview: true, priority: "LOW", supports: [{ signal: sJP2 }] });
  await seedFeedback({ run: run(jPracRun), at: addMinutes(jPracRun.createdAt, 1), viewed: true, summary: "Tu hipótesis mejoró: ahora tiene métrica y umbral. Faltan el plazo y una forma de comparar para saber si el resultado se debe a la franja.", inferenceIds: [iJ4.id, iJ5.id], evidenceIds: [jP1.id, jP2.id] });

  // Sofía: aplicación consistente en dos contextos.
  const spAnswers = {
    p1: "Al menos el 15% de los clientes de envío estándar elige la franja de una hora en un mes; si es menos del 5%, no conviene.",
    p2: "Probaría en dos barrios con perfiles parecidos, uno con la opción y otro sin ella, durante cuatro semanas.",
    p3: "Menos del 5% de adopción o reclamos por demoras en la franja.",
  };
  const sPrac = await seedSubmission({ courseId, studentId: sofia.id, activity: practice, answers: spAnswers, declaredAssistance: "NONE", at: daysAgo(2, 19) });
  const sPracRun = await seedRun({ courseId, studentId: sofia.id, experienceId: sPrac.experience.id, source: "CHALLENGE_SUBMISSION", at: addMinutes(daysAgo(2, 19), 2) });
  const sP1 = await seedEvidence({ run: run(sPracRun), kind: "HYPOTHESIS", observation: "Formuló una hipótesis con métrica, umbral y plazo en logística.", content: spAnswers.p1, sourceText: spAnswers.p1, context: "Práctica en logística, consigna 1.", assistance: "NONE", assistanceSource: "DECLARED", at: daysAgo(2, 19), itemIds: [C4.id], promptKeys: ["p1"], submissionId: sPrac.submission.id });
  const sSP1 = await seedSignal({ evidence: sP1, dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, description: "Hipótesis con métrica, umbral y plazo.", rationale: "Cumple los tres elementos." });
  const sSP1t = await seedSignal({ evidence: sP1, dimension: "TRANSFER", polarity: "STRENGTH", itemId: C4.id, description: "Aplica la estructura de hipótesis fuera del agro.", rationale: "Contexto distinto al propio." });
  const iS3 = await seedInference({ run: sPracRun, at: sPracRun.createdAt, statement: "Aparece evidencia consistente de que Sofía formula hipótesis falsables en contextos distintos (agro y logística).", studentStatement: "En dos actividades y dos contextos distintos formulaste hipótesis comprobables, con métrica, umbral y plazo.", dimension: "APPLICATION", polarity: "STRENGTH", itemId: C4.id, support: "CONSISTENT", rationale: "Dos evidencias en dos experiencias distintas, sin señales opuestas ni asistencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sSP1 }, { signal: sSB2 }], supersedesId: iS1.id });
  const iS4 = await seedInference({ run: sPracRun, at: sPracRun.createdAt, statement: "Sofía aplica la estructura de hipótesis en un contexto distinto al agro.", studentStatement: "Aplicaste la misma estructura en un contexto distinto al tuyo.", dimension: "TRANSFER", polarity: "STRENGTH", itemId: C4.id, support: "PARTIAL", rationale: "Una evidencia de transferencia.", requiresReview: false, priority: "LOW", supports: [{ signal: sSP1t }] });
  await seedFeedback({ run: run(sPracRun), at: addMinutes(sPracRun.createdAt, 1), viewed: true, summary: "Volviste a formular una hipótesis comprobable, esta vez en logística. Con dos actividades en contextos distintos, el patrón empieza a ser consistente.", inferenceIds: [iS3.id, iS4.id], evidenceIds: [sP1.id] });

  await db.intervention.update({ where: { id: intervention.id }, data: { followUpEvidenceAt: daysAgo(3, 20, 5) } });

  // ═════════════ SNAPSHOTS (lógica real, tres momentos) ═════════════
  const withEvidence = [lucia, joaquin, valentina, mateo, camila, sofia];
  for (const asOf of [daysAgo(11, 23, 30), daysAgo(8, 23), new Date()]) {
    for (const s of withEvidence) {
      const evidenceCount = await db.evidenceObject.count({ where: { studentId: s.id, courseId, occurredAt: { lte: asOf } } });
      if (evidenceCount > 0) await computeAndStoreSnapshot({ studentId: s.id, courseId, asOf });
    }
  }

  // ═════════════ EVENTOS DE PRODUCTO (coherentes con la historia del demo) ═════════════
  const events: { name: string; userId?: string; studentId?: string; dedupeKey?: string; properties?: Prisma.InputJsonObject; createdAt: Date }[] = [
    { name: "teacher.curriculum_configured", userId: teacher.id, dedupeKey: `curriculum_configured:${courseId}`, createdAt: daysAgo(15) },
    { name: "teacher.activity_first_analyzed", userId: teacher.id, dedupeKey: `activity_analyzed:${baseline.id}`, properties: { activityId: baseline.id }, createdAt: daysAgo(12, 13) },
    { name: "teacher.activity_first_analyzed", userId: teacher.id, dedupeKey: `activity_analyzed:${practice.id}`, properties: { activityId: practice.id }, createdAt: daysAgo(3, 20) },
    { name: "teacher.insight_opened", userId: teacher.id, dedupeKey: `insight_opened:${teacher.id}:gap:${C4.id}`, properties: { key: `gap:${C4.id}` }, createdAt: daysAgo(8, 9) },
    { name: "teacher.insight_opened", userId: teacher.id, dedupeKey: `insight_opened:${teacher.id}:inference:${iC1.id}`, properties: { key: `inference:${iC1.id}` }, createdAt: daysAgo(8, 9) },
    { name: "teacher.intervention_created", userId: teacher.id, properties: { interventionId: intervention.id, type: "PRACTICE", students: 3 }, createdAt: daysAgo(7, 19) },
    { name: "loop.insight_to_action", userId: teacher.id, dedupeKey: `insight_to_action:gap:${C4.id}`, properties: { key: `gap:${C4.id}`, interventionId: intervention.id }, createdAt: daysAgo(7, 19) },
    { name: "loop.action_to_evidence", userId: teacher.id, studentId: lucia.id, dedupeKey: `action_to_evidence:${intervention.id}:${lucia.id}`, properties: { interventionId: intervention.id }, createdAt: daysAgo(3, 20) },
    { name: "loop.action_to_evidence", userId: teacher.id, studentId: joaquin.id, dedupeKey: `action_to_evidence:${intervention.id}:${joaquin.id}`, properties: { interventionId: intervention.id }, createdAt: daysAgo(2, 22) },
    ...[iM2, iC1, iJ3, iL4].map((i, n) => ({ name: "teacher.inference_reviewed", userId: teacher.id, properties: { inferenceId: i.id }, createdAt: daysAgo(8, 9, n * 10) })),
  ];
  for (const s of [lucia, mateo, valentina, joaquin, camila, sofia]) {
    events.push({ name: "student.onboarding_completed", userId: s.id, studentId: s.id, dedupeKey: `onboarding:${s.id}`, createdAt: daysAgo(14) });
    events.push({ name: "student.first_evidence", userId: s.id, studentId: s.id, dedupeKey: `first_evidence:${s.id}:${courseId}`, createdAt: daysAgo(12) });
    for (const d of [12, 10, 9, 3, 2]) {
      events.push({ name: "student.active_day", userId: s.id, studentId: s.id, dedupeKey: `active:${s.id}:${daysAgo(d).toISOString().slice(0, 10)}`, createdAt: daysAgo(d) });
    }
  }
  await db.productEvent.createMany({
    data: events.map((e) => ({ ...e, courseId })),
    skipDuplicates: true,
  });

  console.log("Seed de demostración listo.");
  console.log(`  Docente:     docente@${DEMO_DOMAIN}`);
  console.log(`  Estudiantes: lucia, mateo, valentina, joaquin, camila, sofia, martin, julieta @${DEMO_DOMAIN}`);
  console.log(`  Contraseña:  ${DEMO_PASSWORD}`);
  console.log(`  Código de la materia: ${course.joinCode}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
