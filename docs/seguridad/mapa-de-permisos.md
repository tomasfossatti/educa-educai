# Mapa de permisos

Generado a partir del código el 15 de noviembre de 2026. Si el código cambia, este mapa se actualiza en el mismo PR.

## Roles

| Rol | Quién | Qué puede hacer |
| --- | --- | --- |
| `STUDENT` | Estudiante inscripto por invitación o código | Sus carpetas, conversaciones, quizzes, contexto, ficha y la lista de accesos a su ficha |
| `TEACHER` | Docente de una cátedra | Su cátedra: material, temas, clases y slides, vista de la clase y fichas de inscriptos con consentimiento |
| `ADMIN` | Administrador del piloto | Cuentas, cátedras y material. No ve conversaciones (V14) |
| Sin sesión | Cualquiera | Login y registro |

La universidad no tiene rol ni acceso a datos individuales (V15).

## Capa de permisos (`src/server/auth/guards.ts`)

| Función | Qué exige | Si falla |
| --- | --- | --- |
| `requireUser` | Sesión válida | Redirige a `/login` |
| `requireStudent` | Sesión de estudiante con perfil y onboarding completo | Redirige |
| `requireTeacher` | Sesión de docente con perfil | Redirige |
| `requireCourseTeacher(courseId)` | Docente dueño de esa cátedra | 404 |
| `requireEnrolledStudent(courseId)` | Estudiante con inscripción activa en la cátedra | 404 |
| `requireTeacherStudent(courseId, studentId)` | Docente de la cátedra y estudiante inscripto en ella. **No exige consentimiento**: la ficha y la evidencia lo exigen aparte | 404 |
| `assertCanViewConversations` y `assertCanViewStudentFile` | El propio estudiante inscripto, o el docente de la cátedra si el estudiante está inscripto y tiene el consentimiento activo | `AccessDenied` |
| `assertFolderOwner(folderId)` | Estudiante dueño de la carpeta | `AccessDenied` |
| `assertCourseTeacher(courseId)` | Docente dueño de la cátedra | `AccessDenied` |
| `hasActiveConsent(profile)` | Consentimiento dado y no retirado | — |

Las funciones `require*` son para páginas y acciones (redirigen o dan 404). Las `assert*` son para servicios y herramientas de los chats (lanzan `AccessDenied`, que las páginas traducen a 404 sin explicar por qué).

Otras lecturas con permisos propios:

- `src/server/services/development.ts`, `teacherVisibleStudentIn`: el detalle de evidencia y de conclusión para el docente exige inscripción y consentimiento activo.
- `src/server/services/attention.ts`: la cola de atención, los insights y el resumen de la clase solo cuentan a estudiantes con consentimiento.
- `src/server/services/class-view.ts`: la vista macro excluye a quien no dio consentimiento del numerador y del denominador (V6).
- `src/server/services/student-file.ts`: la ficha, los vínculos del proyecto (V5) y la apertura de evidencia o conclusión por el docente registran el acceso en `AccessLog`.
- `src/server/services/teacher-chat-tools.ts` y `folder-chat-tools.ts`: las herramientas de los chats reciben un contexto ya filtrado (`assertCourseTeacher`, `assertFolderOwner`), nunca el cliente de la base (V12, V13).

## Páginas y rutas

Las páginas bajo `/s` pasan por el layout `src/app/s/(app)/layout.tsx` (`requireStudent`), las de `/t` por `src/app/t/(home)/layout.tsx` (`requireTeacher`) y las de `/t/courses/[courseId]` por `src/app/t/courses/[courseId]/layout.tsx` (`requireCourseTeacher`). Además, cada página hace su propio control:

| Ruta | Control en la página |
| --- | --- |
| `/login`, `/register` | Públicas. Límite de intentos de login |
| `/` | `getSessionUser`, redirige según el rol |
| `/s`, `/s/context`, `/s/onboarding` | `requireStudent` |
| `/s/join` | `requireStudent` |
| `/s/folders/[folderId]` | `requireStudent` y `assertFolderOwner` |
| `/s/folders/[folderId]/c/[conversationId]` | `requireStudent`; la consulta filtra por estudiante y carpeta |
| `/s/folders/[folderId]/quiz/[quizId]` | `requireStudent`; el servicio verifica el dueño |
| `/s/courses/[courseId]/...` (ficha, evidencia, conclusiones, actividades, desarrollo, tutor) | `requireEnrolledStudent`; las lecturas filtran por el estudiante de la sesión |
| `/t`, `/t/new` | `requireTeacher` |
| `/t/courses/[courseId]/...` (vista, material, temas, clases, atención, insights, métricas, actividades, entregas, estudiantes) | `requireCourseTeacher` |
| `/t/courses/[courseId]/students/[studentId]` | `requireTeacherStudent`; la ficha y el snapshot exigen consentimiento (`loadStudentFile`) |
| `/t/courses/[courseId]/evidence/[evidenceId]` y `/inferences/[inferenceId]` | `requireCourseTeacher` y `openEvidenceAsTeacher` u `openInferenceAsTeacher` (consentimiento y `AccessLog`) |
| `/t/courses/[courseId]/clases/[sessionId]/pptx` (ruta) | `getSessionUser` y `exportSlidesPptx`, que verifica que el docente sea de la cátedra |
| `/api/tutor/[conversationId]` (ruta, tutor heredado) | `getSessionUser`, rol estudiante, conversación propia, chequeo de origen, límite diario y tope semanal de IA |
| `/api/health` (ruta) | Pública. Solo devuelve `ok`, la última migración y la versión |

## Acciones del servidor

| Archivo | Acciones | Control |
| --- | --- | --- |
| `actions/auth.ts` | `registerAction`, `loginAction`, `logoutAction` | Públicas. Login con límite de intentos por correo e IP |
| `actions/folders.ts` | Conversación, pregunta, subida, hilo, respuesta a una duda, borrado, quiz, edición y borrado de contexto | `requireStudent` (función `viewer()`) y el servicio verifica que la carpeta, la conversación o el hecho sean del estudiante |
| `actions/student.ts` | Onboarding, contexto, privacidad, unirse a una cátedra, invitación, conversación del tutor heredado, entregas, respuesta a una conclusión, borrar cuenta | `requireStudent` o `requireEnrolledStudent`; borrar la cuenta pide escribir el correo |
| `actions/teacher.ts` | Cátedra, programa y temas, actividades, invitaciones, quitar estudiante, revisión de conclusiones, intervenciones, material, clases y slides | `requireCourseTeacher`, o `requireTeacher` más un filtro por `course.teacherId` en la consulta (`reviewInferenceAction`, `setTeacherActionStatusAction`) |

## Reglas V1 a V15 y sus tests

| Regla | Test |
| --- | --- |
| V1, V2, V3, V4, V5, V6, V9, V12, V14, V15 | `tests/integration/visibility-stage4.test.ts` |
| V7, V8, V10, V11, V13 | `tests/integration/visibility-stage3.test.ts` |
| V2, V3, V6, V9 y V11 en las vistas heredadas (evidencia, conclusiones, atención, insights, resumen) | `tests/integration/visibility-consent-teacher-views.test.ts` |
| V2, V3, V4 y V8 en el navegador, cambiando ids en la URL | `tests/e2e/permisos.spec.ts` |
| Toda página, ruta y acción llama a un control de permisos (control estático) | `tests/unit/guard-coverage.test.ts` |

Los tests crean sus propios usuarios y cátedras con las fábricas de `tests/support` y corren en cada PR (job `verificar`).
