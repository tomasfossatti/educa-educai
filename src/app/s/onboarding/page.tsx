import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Notice } from "@/components/ui/layout";
import { TEXT } from "@/lib/texts";
import { chooseConsentAction } from "@/server/actions/student";
import { requireStudent } from "@/server/auth/guards";

export const metadata: Metadata = { title: "Antes de empezar" };

/**
 * Alta mínima, una pantalla: una frase verdadera sobre lo que ve el docente, el detalle en "Ver más" y
 * dos botones, "Acepto" y "No, gracias". Ninguno viene elegido: hay que tocar uno. Después, el inicio
 * pide solo el código de la materia (o aceptar la invitación pendiente).
 */
export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { profile } = await requireStudent({ allowIncompleteOnboarding: true });
  if (profile.onboardingCompletedAt) redirect("/s");
  const { error } = await searchParams;
  const t = TEXT.student.consent;

  return (
    <main id="main-content" className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
      <p className="brand-wordmark text-lg" aria-hidden>
        <span className="brand-wordmark-base">educ</span>
        <span className="brand-wordmark-ai">ai</span>
      </p>
      <h1 className="text-2xl font-bold text-ink">{t.title}</h1>
      <p className="text-lg text-ink">{t.phrase}</p>
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm text-muted">{t.seeMore}</summary>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-ink-2">
          {t.details.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
      {error === "consent" && <Notice tone="attention">{t.required}</Notice>}
      <p className="text-base font-semibold text-ink">{t.question}</p>
      <form action={chooseConsentAction} className="grid grid-cols-2 gap-3">
        <button
          type="submit"
          name="consent"
          value="yes"
          className="min-h-12 rounded-xl bg-primary px-4 text-base font-semibold text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.accept}
        </button>
        <button
          type="submit"
          name="consent"
          value="no"
          className="min-h-12 rounded-xl border border-line bg-surface-2 px-4 text-base font-semibold text-ink hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          {t.decline}
        </button>
      </form>
    </main>
  );
}
