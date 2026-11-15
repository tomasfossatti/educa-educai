import { db } from "@/server/db";

/**
 * Estado del servicio para el proveedor (healthCheckPath) y para la prueba de restauración:
 * confirma que la app llega a la base y qué migración está aplicada. No devuelve datos de nadie.
 */
export async function GET() {
  const headers = { "cache-control": "no-store" };
  try {
    const rows = await db.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM _prisma_migrations
      WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL
      ORDER BY finished_at DESC, migration_name DESC LIMIT 1`;
    return Response.json(
      { ok: true, migration: rows[0]?.migration_name ?? null, version: (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.RENDER_GIT_COMMIT)?.slice(0, 7) ?? null },
      { headers },
    );
  } catch {
    return Response.json({ ok: false }, { status: 503, headers });
  }
}
