import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { StudentFileView } from "@/components/domain/student-file-view";
import { ContextSection } from "@/components/student/context-section";
import { CourseSelector } from "@/components/student/course-selector";
import { OpenDetailsFromHash } from "@/components/student/open-details-from-hash";
import { ContextForm, DeleteAccountForm } from "@/components/student/profile-forms";
import { UploadConversationForm } from "@/components/student/upload-form";
import { buttonClass } from "@/components/ui/button";
import { ConfirmSubmit, SubmitButton } from "@/components/ui/client";
import { Checkbox } from "@/components/ui/field";
import { List, ListItem } from "@/components/ui/layout";
import { formatDate, formatDateTime } from "@/lib/format";
import { TEXT } from "@/lib/texts";
import { deleteFolderConversationAction } from "@/server/actions/folders";
import { updatePrivacyAction } from "@/server/actions/student";
import { requireStudent } from "@/server/auth/guards";
import { listAccessToMe } from "@/server/services/access-log";
import { listMyDoubts } from "@/server/services/doubts";
import { listFolderContext } from "@/server/services/folder-context";
import { listMaterials } from "@/server/services/material";
import { loadProjectLinks, loadStudentFile } from "@/server/services/student-file";
import { getPanelState, listMyConclusions, listMyConversations } from "@/server/services/student-panel";
import { JoinForm } from "../join/join-form";

export const metadata: Metadata = { title: "Mis datos" };

/** Una sección plegable de Mis datos, con un título corto y su ancla (#id). */
function Fold({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <details id={id} className="group rounded-xl border border-line bg-surface">
      <summary className="flex min-h-14 cursor-pointer items-center px-4 text-base font-semibold text-ink focus-visible:outline-2 focus-visible:outline-primary">
        {title}
      </summary>
      <div className="space-y-4 border-t border-line p-4">{children}</div>
    </details>
  );
}

/**
 * Mis datos: un solo lugar con todo lo que no es preguntar ni practicar. Lo que la IA sabe de mí,
 * lo que ve mi docente (la misma ficha, V7) y quién la abrió (V9), el consentimiento (V11), mis
 * charlas para borrar (V10), mis dudas, la descarga, sumarse a otra materia, el LMS, subir una charla
 * y mi perfil. Todo pasa por servicios que filtran por el propio estudiante.
 */
export default async function MyDataPage() {
  const { user, profile } = await requireStudent();
  const viewer = { id: user.id, role: user.role };
  const { options, current } = await getPanelState(viewer);
  const t = TEXT.student.myData;
  const s = TEXT.student;
  const courseId = current?.courseId ?? null;
  const consent = Boolean(profile.consentAnalysisAt);

  const [context, conversations, doubts, accesses, file, links, conclusions] = await Promise.all([
    current ? listFolderContext(viewer, current.folderId) : null,
    listMyConversations(viewer),
    listMyDoubts(viewer),
    listAccessToMe(viewer),
    courseId ? loadStudentFile(viewer, user.id, courseId) : null,
    courseId ? loadProjectLinks(viewer, user.id, courseId) : null,
    courseId ? listMyConclusions(viewer, courseId) : [],
  ]);
  // Materia traída del LMS por el estudiante: su propio material (solo lo ve él).
  const lmsMaterial = current && current.kind === "SUBJECT" && !current.courseId ? await listMaterials({ folderId: current.folderId }) : null;
  const courseAccesses = courseId ? accesses.filter((a) => a.courseId === courseId) : [];

  return (
    <div className="shell mx-auto max-w-3xl space-y-4">
      <OpenDetailsFromHash />
      <h1 className="text-2xl font-bold text-ink">{t.title}</h1>
      {current && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{t.courseLabel}</span>
          <CourseSelector options={options} current={current} next="/s/mis-datos" as="h2" />
        </div>
      )}

      {current && context && (
        <Fold id="ia" title={t.aiKnows}>
          <ContextSection summary={context.summary} facts={context.facts} trace={context.trace} consent={consent} />
        </Fold>
      )}

      <Fold id="docente" title={t.teacherSees}>
        {file && links ? (
          <>
            <p className="text-sm text-muted">{t.teacherSeesHint}</p>
            <StudentFileView file={file} projectLinks={links} labels={s.file} />
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-ink">{t.conclusions}</h3>
              <p className="text-sm text-muted">{t.conclusionsHint}</p>
              {conclusions.length === 0 ? (
                <p className="text-sm text-muted">{t.noConclusions}</p>
              ) : (
                <List>
                  {conclusions.map((c) => (
                    <ListItem key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm text-ink">{c.studentStatement ?? c.statement}</span>
                      <Link
                        href={`/s/courses/${courseId}/inferences/${c.id}`}
                        className={buttonClass("secondary", "md", "min-h-11")}
                      >
                        {t.respond}
                      </Link>
                    </ListItem>
                  ))}
                </List>
              )}
            </section>
            <section className="space-y-2">
              <h3 className="text-base font-semibold text-ink">{t.whoOpened}</h3>
              {courseAccesses.length === 0 ? (
                <p className="text-sm text-muted">{t.nobodyOpened}</p>
              ) : (
                <List>
                  {courseAccesses.map((a) => (
                    <ListItem key={a.id} className="text-sm">
                      <span className="text-ink">{a.viewerName}</span> {s.file.accessView[a.view]}
                      <span className="ml-2 text-xs text-muted">{formatDateTime(a.createdAt)}</span>
                    </ListItem>
                  ))}
                </List>
              )}
            </section>
          </>
        ) : (
          <p className="text-sm text-muted">{t.onlyCourse}</p>
        )}
      </Fold>

      <Fold id="consentimiento" title={t.consent}>
        <p className="text-base text-ink">{s.consent.phrase}</p>
        <p className="text-sm text-muted">{consent ? `${s.consent.given} (${formatDate(profile.consentAnalysisAt)})` : s.consent.notGiven}</p>
        <form action={updatePrivacyAction}>
          {!consent && <input type="hidden" name="consent" value="on" />}
          {profile.shareContextWithTeachers && <input type="hidden" name="shareContext" value="on" />}
          <SubmitButton variant={consent ? "danger" : "primary"} className="min-h-11 px-6">
            {consent ? s.consent.withdraw : s.consent.give}
          </SubmitButton>
        </form>
      </Fold>

      <Fold id="charlas" title={t.conversations}>
        <p className="text-sm text-muted">{t.conversationsHint}</p>
        {conversations.length === 0 ? (
          <p className="text-sm text-muted">{t.noConversations}</p>
        ) : (
          <List>
            {conversations.map((c) => (
              <ListItem key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <Link href={`/s/c/${c.id}`} className="min-w-0 text-sm text-ink hover:underline">
                  {c.title}
                  <span className="ml-2 text-xs text-muted">
                    {c.folder?.kind === "PROJECT" ? s.selector.project : c.folder?.name} · {formatDate(c.createdAt)}
                  </span>
                </Link>
                <form action={deleteFolderConversationAction.bind(null, c.id)}>
                  <ConfirmSubmit variant="ghost" message={t.conversationsHint} aria-label={`${t.deleteConversation}: ${c.title}`} className="min-h-11">
                    {t.deleteConversation}
                  </ConfirmSubmit>
                </form>
              </ListItem>
            ))}
          </List>
        )}
      </Fold>

      <Fold id="dudas" title={t.doubts}>
        {doubts.length === 0 ? (
          <p className="text-sm text-muted">{t.noDoubts}</p>
        ) : (
          <List>
            {doubts.map((d) => (
              <ListItem key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink">
                  {d.curriculumItem?.title} <span className="text-xs text-muted">· {d.course.name}</span>
                </span>
                <span className="text-muted">{t.doubtStatus[d.studentStatus]}</span>
              </ListItem>
            ))}
          </List>
        )}
      </Fold>

      <Fold id="descargar" title={t.download}>
        <p className="text-sm text-muted">{t.downloadHint}</p>
        {/* Enlace común, no <Link>: es una descarga, no una navegación de la app. */}
        <a href="/s/context/export" download className={buttonClass("secondary", "md", "min-h-11")}>
          {t.download}
        </a>
      </Fold>

      <Fold id="unirme" title={t.join}>
        <JoinForm />
      </Fold>

      <Fold id="lms" title={t.lms}>
        <Link href="/s/asistente" className={buttonClass("secondary", "md", "min-h-11")}>
          {t.lms}
        </Link>
        {lmsMaterial && (
          <section className="space-y-2 pt-2">
            <h3 className="text-base font-semibold text-ink">
              {t.material}: {current?.label}
            </h3>
            <p className="text-sm text-muted">{t.materialHint}</p>
            {lmsMaterial.length === 0 ? (
              <p className="text-sm text-muted">{t.noMaterial}</p>
            ) : (
              <List>
                {lmsMaterial
                  .slice()
                  .sort((a, b) => a.fileName.localeCompare(b.fileName, "es", { numeric: true }))
                  .map((m) => (
                    <ListItem key={m.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-ink">{m.fileName}</span>
                      <span className="text-muted">{t.materialStatus[m.status]}</span>
                    </ListItem>
                  ))}
              </List>
            )}
          </section>
        )}
      </Fold>

      {current && (
        <Fold id="subir" title={t.upload}>
          <p className="text-sm text-muted">{t.uploadHint}</p>
          <UploadConversationForm folderId={current.folderId} />
        </Fold>
      )}

      <Fold id="perfil" title={t.profile}>
        <p className="text-sm text-muted">{s.profileForm.hint}</p>
        <ContextForm
          focus={profile.personalizationFocus}
          defaults={{
            currentContext: profile.declaredCurrentContext ?? "",
            interests: profile.declaredInterests ?? "",
            goals: profile.declaredGoals ?? "",
            strengths: profile.declaredStrengths ?? "",
            difficulties: profile.declaredDifficulties ?? "",
            workPreferences: profile.declaredWorkPreferences ?? "",
          }}
        />
        <form action={updatePrivacyAction} className="space-y-3 border-t border-line pt-4">
          {consent && <input type="hidden" name="consent" value="on" />}
          <Checkbox name="shareContext" defaultChecked={profile.shareContextWithTeachers} label={t.shareProfile} />
          <SubmitButton variant="secondary" className="min-h-11">
            {t.saveSharing}
          </SubmitButton>
        </form>
        <div className="space-y-2 border-t border-line pt-4">
          <h3 className="text-base font-semibold text-ink">{t.deleteAccount}</h3>
          <p className="text-sm text-muted">{t.deleteAccountHint}</p>
          <DeleteAccountForm email={user.email} />
        </div>
      </Fold>
    </div>
  );
}
