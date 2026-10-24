import crypto from 'crypto';
import {
  StudentInteractionSession,
  TeacherDashboardHeatmapReport,
} from './types.js';

/**
 * ============================================================================
 * EDUCAI: ESQUEMA DE COLECCIONES EN FIREBASE FIRESTORE
 * ============================================================================
 * 
 * Topología de Colecciones:
 * 
 * courses/{courseId}
 *   │
 *   ├── interaction_sessions/{sessionId}   (Documentos de sesiones individuales)
 *   │     ├── id: string
 *   │     ├── anonymousStudentId: string  (Hash HMAC-SHA256, sin PII)
 *   │     ├── assignmentId: string | number
 *   │     ├── moduleUnit: string
 *   │     ├── primaryConcept: string
 *   │     ├── resolutionStatus: "resolved" | "blocked" | ...
 *   │     ├── struggleLevel: "low" | "medium" | "high" | "critical"
 *   │     ├── cognitiveFrictionScore: number (0-100)
 *   │     ├── startedAt: Timestamp
 *   │     ├── endedAt: Timestamp
 *   │     └── messages/ {messageId}       (Subcolección de mensajes del diálogo)
 *   │
 *   ├── heatmaps/{heatmapId}               (Historial cronológico de reportes generados)
 *   │     ├── generatedAt: Timestamp
 *   │     ├── hotspots: Array<HeatmapHotspot>
 *   │     └── nextClassActionPlan: Object
 *   │
 *   └── analytics/current_heatmap          (Último reporte activo para consumo inmediato del dashboard)
 */

export const FIRESTORE_COLLECTIONS = {
  COURSES: 'courses',
  INTERACTION_SESSIONS: 'interaction_sessions',
  MESSAGES: 'messages',
  HEATMAPS: 'heatmaps',
  ANALYTICS: 'analytics',
} as const;

/**
 * Genera un identificador pseudónimo no reversible para el estudiante mediante HMAC-SHA256.
 * Cumple con principios de Privacy-by-Design (GDPR / FERPA):
 * Permite agrupar dudas del mismo alumno sin exponer su nombre, DNI o email institucional.
 */
export function generatePseudonymousStudentId(
  rawStudentId: string | number,
  saltKey: string = process.env.STUDENT_HASH_SALT || 'educai_siglo21_salt_secret'
): string {
  const hmac = crypto.createHmac('sha256', saltKey);
  hmac.update(String(rawStudentId).trim().toLowerCase());
  return `stu_${hmac.digest('hex').substring(0, 16)}`;
}

/**
 * Reglas de Seguridad de Firebase Firestore (firestore.rules)
 * Modelo declarativo para proteger la privacidad de alumnos y restringir acceso a docentes.
 */
export const FIRESTORE_SECURITY_RULES_TEMPLATE = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Función auxiliar para validar autenticación
    function isAuthenticated() {
      return request.auth != null;
    }

    // Comprobar rol de docente mediante Custom Claims de Firebase Auth
    function isCourseTeacher(courseId) {
      return isAuthenticated() && 
             (request.auth.token.role == 'teacher' || request.auth.token.role == 'admin') &&
             courseId in request.auth.token.course_ids;
    }

    // Comprobar si el solicitante es el alumno dueño de la sesión
    function isSessionOwner(studentPseudoId) {
      return isAuthenticated() && request.auth.token.anonymous_student_id == studentPseudoId;
    }

    // Reglas para Cursos
    match /courses/{courseId} {
      allow read: if isAuthenticated();
      
      // Sesiones de interacción con el tutor socrático
      match /interaction_sessions/{sessionId} {
        // El alumno puede crear y leer sus propias sesiones de estudio
        allow create: if isAuthenticated();
        allow read, update: if isSessionOwner(resource.data.anonymousStudentId) || isCourseTeacher(courseId);
        allow delete: if false; // Trazas inmutables para integridad académica
        
        match /messages/{messageId} {
          allow read, write: if isSessionOwner(get(/databases/$(database)/documents/courses/$(courseId)/interaction_sessions/$(sessionId)).data.anonymousStudentId) 
                             || isCourseTeacher(courseId);
        }
      }
      
      // Historial y reportes de Mapa de Calor
      match /heatmaps/{heatmapId} {
        allow read: if isCourseTeacher(courseId);
        allow write: if false; // Solo generado por backend/Cloud Functions autorizadas
      }
      
      // Dashboard activo del docente
      match /analytics/current_heatmap {
        allow read: if isCourseTeacher(courseId);
        allow write: if false; // Solo administrado por el Motor de Agregación
      }
    }
  }
}
`;

/**
 * Interfaz para el repositorio de persistencia de interacciones y mapas de calor
 */
export interface IHeatmapRepository {
  recordInteractionSession(session: StudentInteractionSession): Promise<void>;
  fetchRecentSessions(courseId: string | number, sinceDate: Date): Promise<StudentInteractionSession[]>;
  saveHeatmapReport(report: TeacherDashboardHeatmapReport): Promise<void>;
  getLatestHeatmapReport(courseId: string | number): Promise<TeacherDashboardHeatmapReport | null>;
}

/**
 * Repositorio en memoria con compatibilidad para Firestore
 * Provee persistencia local para testing rápido o conexión directa al SDK de Firebase Admin
 */
export class InMemoryHeatmapRepository implements IHeatmapRepository {
  private sessionsByCourse: Map<string, StudentInteractionSession[]> = new Map();
  private heatmapsByCourse: Map<string, TeacherDashboardHeatmapReport> = new Map();

  async recordInteractionSession(session: StudentInteractionSession): Promise<void> {
    const key = String(session.courseId);
    const existing = this.sessionsByCourse.get(key) || [];
    existing.push(session);
    this.sessionsByCourse.set(key, existing);
  }

  async fetchRecentSessions(
    courseId: string | number,
    sinceDate: Date
  ): Promise<StudentInteractionSession[]> {
    const key = String(courseId);
    const sessions = this.sessionsByCourse.get(key) || [];
    const sinceMs = sinceDate.getTime();
    return sessions.filter((s) => new Date(s.startedAt).getTime() >= sinceMs);
  }

  async saveHeatmapReport(report: TeacherDashboardHeatmapReport): Promise<void> {
    const key = String(report.courseId);
    this.heatmapsByCourse.set(key, report);
  }

  async getLatestHeatmapReport(
    courseId: string | number
  ): Promise<TeacherDashboardHeatmapReport | null> {
    const key = String(courseId);
    return this.heatmapsByCourse.get(key) || null;
  }
}
