import type { Metadata } from "next";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { requireTeacher } from "@/server/auth/guards";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Tus materias" };

const CURRICULUM_LABEL = {
  NOT_STARTED: "Currícula sin cargar",
  EXTRACTING: "Procesando programa",
  IN_REVIEW: "Currícula en revisión",
  CONFIGURED: "Currícula configurada",
  FAILED: "Error al procesar programa",
} as const;

type CourseStatusType = "neutral" | "evidence" | "open" | "recommendation";

function CourseStatusIcon({ type }: { type: CourseStatusType }) {
  if (type === "evidence") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-3.5 h-3.5 inline-block">
        <path d="M8 2.25 9.25 5.5 12.5 6.75 9.25 8 8 11.25 6.75 8 3.5 6.75 6.75 5.5 8 2.25Z" stroke="currentColor" strokeLinejoin="round" />
        <path d="m12.25 10 .55 1.45 1.45.55-1.45.55-.55 1.45-.55-1.45-1.45-.55 1.45-.55.55-1.45Z" stroke="currentColor" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "open") {
    return (
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-3.5 h-3.5 inline-block">
        <circle cx="8" cy="8" r="5.25" stroke="currentColor" />
        <path d="M8 5v3.2l2.1 1.3" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="w-3.5 h-3.5 inline-block">
      <circle cx="8" cy="8" r="5.25" stroke="currentColor" />
      <path d="M5.5 8h5" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

export default async function TeacherHome() {
  const { user } = await requireTeacher();
  const courses = await db.course.findMany({
    where: { teacherId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { enrollments: { where: { status: "ACTIVE" } } } },
    },
  });
  const pending = await db.inference.groupBy({
    by: ["courseId"],
    where: { course: { teacherId: user.id }, state: "ACTIVE", requiresReview: true, reviewStatus: "PENDING" },
    _count: { _all: true },
  });
  const pendingByCourse = new Map(pending.map((p) => [p.courseId, p._count._all]));

  return (
    <div className="shell teacher-dashboard">
      <section className="workspace-header compact teacher-dashboard-header">
        <div className="workspace-head-row teacher-dashboard-head-row">
          <div className="teacher-dashboard-intro">
            <div className="eyebrow">Espacio docente</div>
            <h1>Volvé al trabajo</h1>
            <p>Prepará el contexto, observá señales agregadas y decidí qué hacer en la próxima clase.</p>
          </div>
          <div className="header-actions">
            <Link className={`${courses.length ? "btn secondary" : "btn"} teacher-create-course`} href="/t/new">
              Crear materia
            </Link>
          </div>
        </div>
      </section>

      <section className="section first-section teacher-courses-section">
        <div className="section-title teacher-courses-heading">
          <div>
            <div className="label">Tus materias</div>
            <h2>Elegí dónde continuar</h2>
            <p>Las señales que requieren atención aparecen antes que las métricas descriptivas.</p>
          </div>
        </div>

        {courses.length ? (
          <div className="grid two teacher-course-grid">
            {courses.map((c) => {
              const pendingCount = pendingByCourse.get(c.id) ?? 0;
              const hasEvidence = pendingCount > 0;
              return (
                <Link
                  href={`/t/courses/${c.id}`}
                  className={`card course-card interactive teacher-course-card${hasEvidence ? " has-evidence" : ""}`}
                  key={c.id}
                >
                  <div className="teacher-course-card-header">
                    <h3>{c.name}</h3>
                    {pendingCount > 0 ? (
                      <span className="badge teacher-status-badge evidence">
                        <CourseStatusIcon type="evidence" />
                        <span>{pendingCount} inferencias por revisar</span>
                      </span>
                    ) : (
                      <span className="badge teacher-status-badge ok">
                        <CourseStatusIcon type="open" />
                        <span>{CURRICULUM_LABEL[c.curriculumStatus]}</span>
                      </span>
                    )}
                  </div>
                  <p className="teacher-course-description">
                    {c.description || "Tomar decisiones de negocio con evidencia: segmentación, hipótesis falsables y experimentos simples."}
                  </p>
                  <div className="teacher-course-divider" aria-hidden="true" />
                  <div className="course-card-footer teacher-course-meta">
                    <span><strong>{c._count.enrollments}</strong> estudiantes</span>
                    <span><strong>{CURRICULUM_LABEL[c.curriculumStatus]}</strong></span>
                    <span>Código <strong>{c.joinCode}</strong></span>
                  </div>
                  <span className="teacher-course-cta">
                    Abrir workspace <span className="teacher-course-cta-arrow" aria-hidden="true">→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="empty center">
            <strong>Creá tu primera materia</strong>
            <span>Después vas a poder cargar el programa, crear actividades y recibir evidencia.</span>
            <div className="empty-action">
              <ButtonLink href="/t/new" variant="primary">Crear materia</ButtonLink>
            </div>
          </div>
        )}
      </section>

      <div className="privacy-compact footer-privacy teacher-dashboard-privacy">
        Educai muestra patrones agregados. No permite abrir conversaciones privadas ni construir perfiles individuales de estudiantes.
      </div>
    </div>
  );
}
