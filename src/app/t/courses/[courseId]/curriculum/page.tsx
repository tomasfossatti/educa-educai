import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh, SubmitButton } from "@/components/ui/client";
import { EmptyState, List, ListItem, Notice, PageHeader, Section } from "@/components/ui/layout";
import { curriculumKindPlural } from "@/domain/labels";
import { acceptAllProposedAction, confirmCurriculumAction, setCurriculumItemStatusAction } from "@/server/actions/teacher";
import { isAIConfigured } from "@/server/ai";
import { requireCourseTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";
import { ItemForm, ProgramForm } from "./forms";

export const metadata: Metadata = { title: "Currícula" };

const KINDS = ["CONCEPT", "OBJECTIVE", "COMPETENCY", "CRITERION"] as const;

export default async function CurriculumPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const { course } = await requireCourseTeacher(courseId);
  const items = await db.curriculumItem.findMany({
    where: { courseId },
    orderBy: [{ kind: "asc" }, { position: "asc" }],
    include: { parent: { select: { title: true } } },
  });
  const proposed = items.filter((i) => i.status === "PROPOSED").length;
  const accepted = items.filter((i) => i.status === "ACCEPTED").length;
  const parents = items.filter((i) => (i.kind === "OBJECTIVE" || i.kind === "COMPETENCY") && i.status !== "ARCHIVED").map((i) => ({ id: i.id, title: i.title }));
  const extracting = course.curriculumStatus === "EXTRACTING";
  const aiReady = isAIConfigured();

  return (
    <>
      <AutoRefresh active={extracting} />
      <PageHeader
        title="Currícula"
        description="Qué espera desarrollar la materia. Es la referencia con la que Educai interpreta la evidencia: conviene que la revises."
        actions={
          items.length > 0 && !extracting ? (
            <form action={confirmCurriculumAction.bind(null, courseId)}>
              <SubmitButton disabled={accepted === 0} pendingText="Confirmando…">
                {course.curriculumStatus === "CONFIGURED" ? "Volver a confirmar" : "Confirmar currícula"}
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      <div className="space-y-10">
        {extracting && (
          <Notice title="Procesando el programa">
            Educai está leyendo el programa y proponiendo conceptos, objetivos, competencias y criterios. Suele tardar menos de un minuto.
          </Notice>
        )}
        {course.curriculumStatus === "FAILED" && course.curriculumError && (
          <Notice tone="error" title="No se pudo procesar el programa">
            {course.curriculumError}
          </Notice>
        )}
        {course.curriculumStatus === "CONFIGURED" && (
          <Notice tone="success">
            Currícula configurada con {accepted} ítems aceptados. Podés seguir editándola: los cambios aplican a los análisis nuevos.
          </Notice>
        )}
        {course.curriculumNotes && course.curriculumStatus !== "EXTRACTING" && (
          <Notice title="Notas de la extracción">{course.curriculumNotes}</Notice>
        )}

        {(course.curriculumStatus === "NOT_STARTED" || course.curriculumStatus === "FAILED") && (
          <Section title="Cargar el programa" description="Educai propone una estructura; vos la revisás y la confirmás.">
            {aiReady ? (
              <ProgramForm courseId={courseId} defaultText={course.programText ?? ""} />
            ) : (
              <Notice tone="attention">El servicio de IA no está configurado. Podés cargar los ítems manualmente abajo.</Notice>
            )}
          </Section>
        )}

        {items.length > 0 && (
          <Section
            title="Revisión del mapeo"
            description={`${accepted} aceptados · ${proposed} propuestos por IA pendientes de revisión. Solo los aceptados se usan para interpretar evidencia.`}
            action={
              proposed > 0 ? (
                <form action={acceptAllProposedAction.bind(null, courseId)}>
                  <SubmitButton size="sm" variant="secondary">
                    Aceptar todas las propuestas
                  </SubmitButton>
                </form>
              ) : undefined
            }
          >
            <div className="space-y-8">
              {KINDS.map((kind) => {
                const list = items.filter((i) => i.kind === kind);
                if (list.length === 0) return null;
                return (
                  <div key={kind} className="space-y-2">
                    <h3 className="text-sm font-semibold text-ink">{curriculumKindPlural[kind]}</h3>
                    <List>
                      {list.map((item) => (
                        <ListItem key={item.id} className={item.status === "ARCHIVED" ? "opacity-60" : undefined}>
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-ink">{item.title}</span>
                                {item.status === "PROPOSED" && <Badge tone="attention">Propuesto por IA</Badge>}
                                {item.status === "ACCEPTED" && <Badge tone="primary">Aceptado</Badge>}
                                {item.status === "ARCHIVED" && <Badge tone="muted">Descartado</Badge>}
                                {item.origin === "TEACHER" && <Badge tone="muted">Agregado por vos</Badge>}
                              </div>
                              {item.description && <p className="text-sm text-ink-2">{item.description}</p>}
                              {item.parent && <p className="text-xs text-muted">Evalúa: {item.parent.title}</p>}
                              {item.sourceExcerpt && <p className="text-xs text-muted">Fuente en el programa: «{item.sourceExcerpt}»</p>}
                              {item.origin === "AI_PROPOSED" && !item.sourceExcerpt && (
                                <p className="text-xs text-muted">Derivado por la IA, sin cita textual del programa.</p>
                              )}
                            </div>
                            <div className="flex shrink-0 gap-1">
                              {item.status !== "ACCEPTED" && (
                                <form action={setCurriculumItemStatusAction.bind(null, item.id, "ACCEPTED")}>
                                  <SubmitButton size="sm" variant="secondary">
                                    Aceptar
                                  </SubmitButton>
                                </form>
                              )}
                              {item.status !== "ARCHIVED" && (
                                <form action={setCurriculumItemStatusAction.bind(null, item.id, "ARCHIVED")}>
                                  <SubmitButton size="sm" variant="ghost">
                                    Descartar
                                  </SubmitButton>
                                </form>
                              )}
                            </div>
                          </div>
                          {item.status !== "ARCHIVED" && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs text-primary hover:underline">Editar</summary>
                              <div className="mt-3">
                                <ItemForm courseId={courseId} parents={parents.filter((p) => p.id !== item.id)} item={item} />
                              </div>
                            </details>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </div>
                );
              })}
            </div>
          </Section>
        )}

        {!extracting && (
          <Section title="Agregar un ítem" description="Para lo que la extracción no capturó o si preferís armarla a mano.">
            {items.length === 0 && course.curriculumStatus === "NOT_STARTED" && (
              <EmptyState title="Todavía no hay ítems">Cargá el programa arriba o agregalos manualmente.</EmptyState>
            )}
            <ItemForm courseId={courseId} parents={parents} />
          </Section>
        )}

        {(course.curriculumStatus === "IN_REVIEW" || course.curriculumStatus === "CONFIGURED") && aiReady && (
          <Section title="Volver a procesar el programa" description="Reemplaza solo las propuestas pendientes; lo aceptado y lo que agregaste se conserva.">
            <details>
              <summary className="cursor-pointer text-sm text-primary hover:underline">Mostrar</summary>
              <div className="mt-3">
                <ProgramForm courseId={courseId} defaultText={course.programText ?? ""} />
              </div>
            </details>
          </Section>
        )}
      </div>
    </>
  );
}
