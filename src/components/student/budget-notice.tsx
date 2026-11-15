import { Notice } from "@/components/ui/layout";
import { TEXT } from "@/lib/texts";
import { budgetResetLabel, getStudentBudget } from "@/server/ai/budget";

/** Aviso del tope semanal de IA: aparece desde el umbral de alerta (80% por defecto). */
export async function BudgetNotice({ studentId }: { studentId: string }) {
  const budget = await getStudentBudget(studentId);
  if (budget.state === "ok") return null;
  const resets = budgetResetLabel();
  if (budget.state === "exceeded") return <Notice tone="attention">{TEXT.budget.exceeded(resets)}</Notice>;
  const pct = Math.min(99, Math.floor((budget.spentUsd / budget.capUsd) * 100));
  return <Notice>{TEXT.budget.warning(pct, resets)}</Notice>;
}
