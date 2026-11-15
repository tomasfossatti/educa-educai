import "server-only";
import { db } from "@/server/db";
import { CONSENT_VERSION } from "@/lib/constants";

/**
 * Da o retira el consentimiento de análisis. Al retirarlo se deja de analizar desde ese momento
 * y el docente pierde acceso a las conversaciones (V11); lo ya generado se conserva para el estudiante.
 */
export async function setAnalysisConsent(studentId: string, consent: boolean): Promise<void> {
  const profile = await db.studentProfile.findUniqueOrThrow({ where: { userId: studentId }, select: { consentAnalysisAt: true } });
  const now = new Date();
  await db.studentProfile.update({
    where: { userId: studentId },
    data: consent
      ? { consentAnalysisAt: profile.consentAnalysisAt ?? now, consentVersion: CONSENT_VERSION, consentWithdrawnAt: null }
      : { consentAnalysisAt: null, consentVersion: null, consentWithdrawnAt: profile.consentAnalysisAt ? now : undefined },
  });
}
