import "server-only";
import { refresh as nextRefresh } from "next/cache";

/**
 * `refresh()` de Next para usar al final de una Server Action.
 *
 * En la prueba de carga de la etapa 6, `refresh()` lanzó a veces "refresh can only be called from
 * within a Server Action" cuando la acción ya había terminado su trabajo (por ejemplo, la
 * conversación cerrada y el análisis encolado), y el estudiante veía una página de error. Ese
 * error indica que el pedido ya no está en la fase de acción sino en la de render, que vuelve a
 * armar la página con los datos nuevos: no hay nada que refrescar. Solo se tolera ese caso.
 */
export function refresh(): void {
  try {
    nextRefresh();
  } catch (error) {
    if (isOutsideActionError(error)) {
      console.warn("[acciones] refresh() fuera de la fase de acción: la página se vuelve a renderizar igual");
      return;
    }
    throw error;
  }
}

export function isOutsideActionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as Error & { __NEXT_ERROR_CODE?: string }).__NEXT_ERROR_CODE;
  return code === "E870" || error.message.startsWith("refresh can only be called from within a Server Action");
}
