import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, List, ListItem, PageHeader } from "@/components/ui/layout";
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
    <>
      <PageHeader title="Tus materias" actions={<ButtonLink href="/t/new" variant="primary">Crear materia</ButtonLink>} />
      {courses.length === 0 ? (
        <EmptyState title="Todavía no creaste ninguna materia" action={<ButtonLink href="/t/new" variant="primary">Crear materia</ButtonLink>}>
          Empezá creando una materia y cargando su programa: Educai propone el mapeo curricular para que lo revises.
        </EmptyState>
      ) : (
        <List>
          {courses.map((c) => (
            <ListItem key={c.id} className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <Link href={`/t/courses/${c.id}`} className="font-medium text-ink hover:text-primary">
                  {c.name}
                </Link>
                <p className="text-xs text-muted">
                  {c._count.enrollments} estudiantes · {CURRICULUM_LABEL[c.curriculumStatus]}
                </p>
              </div>
              {(pendingByCourse.get(c.id) ?? 0) > 0 && <Badge tone="attention">{pendingByCourse.get(c.id)} inferencias por revisar</Badge>}
            </ListItem>
          ))}
        </List>
      )}
    </>
  );
}
