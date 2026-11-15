/**
 * Aplica los plazos de conservación (src/server/services/retention.ts).
 *   npm run retention            → solo cuenta lo que se borraría
 *   npm run retention -- --apply → borra
 * Sin las variables RETENTION_* no hace nada. Solo imprime cantidades.
 */
import { db } from "@/server/db";
import { applyRetention, retentionPolicy } from "@/server/services/retention";

async function main() {
  const apply = process.argv.includes("--apply");
  const policy = retentionPolicy();
  console.log("Política:", JSON.stringify(policy));
  if (!policy.conversationDays && !policy.accessLogDays && !policy.aiUsageDays) {
    console.log("No hay plazos configurados: no se borra nada.");
    return;
  }
  const result = await applyRetention(policy, { dryRun: !apply });
  console.log(apply ? "Aplicado:" : "Se borraría (prueba, sin cambios):", JSON.stringify(result));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
