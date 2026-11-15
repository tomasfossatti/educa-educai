import "server-only";
import { db } from "@/server/db";
import { deleteExperienceCascade } from "@/server/services/privacy";

/**
 * Plazos de conservación (docs/legal/tratamiento-de-datos.md). Los fija Tomás con el abogado; cada
 * variable vacía deja ese plazo apagado, que es el valor por defecto: sin decisión no se borra nada.
 *   RETENTION_CONVERSATION_DAYS  conversaciones y todo lo derivado, quizzes y dominio
 *   RETENTION_ACCESS_LOG_DAYS    registro de accesos a fichas y evidencia
 *   RETENTION_AI_USAGE_DAYS      el registro de costo de IA se desvincula de la persona
 */
export interface RetentionPolicy {
  conversationDays: number | null;
  accessLogDays: number | null;
  aiUsageDays: number | null;
}

function days(raw: string | undefined): number | null {
  if (!raw?.trim()) return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 30 ? n : null; // menos de 30 días se considera un error de configuración
}

export function retentionPolicy(): RetentionPolicy {
  return {
    conversationDays: days(process.env.RETENTION_CONVERSATION_DAYS),
    accessLogDays: days(process.env.RETENTION_ACCESS_LOG_DAYS),
    aiUsageDays: days(process.env.RETENTION_AI_USAGE_DAYS),
  };
}

export interface RetentionResult {
  conversations: number;
  quizAttempts: number;
  masteryRecords: number;
  accessLogs: number;
  aiUsageUnlinked: number;
}

const cutoff = (now: Date, d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

/** Aplica la política. Con `dryRun` solo cuenta. Nunca devuelve contenido, solo cantidades. */
export async function applyRetention(policy: RetentionPolicy, opts: { now?: Date; dryRun?: boolean } = {}): Promise<RetentionResult> {
  const now = opts.now ?? new Date();
  const result: RetentionResult = { conversations: 0, quizAttempts: 0, masteryRecords: 0, accessLogs: 0, aiUsageUnlinked: 0 };

  if (policy.conversationDays) {
    const before = cutoff(now, policy.conversationDays);
    const expired = await db.aIConversation.findMany({
      where: { OR: [{ closedAt: { lt: before } }, { closedAt: null, createdAt: { lt: before } }] },
      select: { experienceId: true, studentId: true, courseId: true },
    });
    result.conversations = expired.length;
    const quizWhere = { createdAt: { lt: before } };
    const masteryWhere = { updatedAt: { lt: before } };
    if (opts.dryRun) {
      result.quizAttempts = await db.quizAttempt.count({ where: quizWhere });
      result.masteryRecords = await db.masteryRecord.count({ where: masteryWhere });
    } else {
      // El mismo borrado que hace el estudiante (V10): evidencia, dudas, conclusiones y contexto derivado.
      for (const c of expired) await deleteExperienceCascade(c.experienceId, c.studentId, c.courseId);
      result.quizAttempts = (await db.quizAttempt.deleteMany({ where: quizWhere })).count;
      result.masteryRecords = (await db.masteryRecord.deleteMany({ where: masteryWhere })).count;
    }
  }

  if (policy.accessLogDays) {
    const where = { createdAt: { lt: cutoff(now, policy.accessLogDays) } };
    result.accessLogs = opts.dryRun ? await db.accessLog.count({ where }) : (await db.accessLog.deleteMany({ where })).count;
  }

  if (policy.aiUsageDays) {
    const where = { createdAt: { lt: cutoff(now, policy.aiUsageDays) }, OR: [{ studentId: { not: null } }, { actorUserId: { not: null } }] };
    result.aiUsageUnlinked = opts.dryRun
      ? await db.aIUsageEvent.count({ where })
      : (await db.aIUsageEvent.updateMany({ where, data: { studentId: null, actorUserId: null } })).count;
  }

  return result;
}
