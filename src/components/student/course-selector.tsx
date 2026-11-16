import { ChevronDown } from "lucide-react";
import { TEXT } from "@/lib/texts";
import { selectFolderAction } from "@/server/actions/student";
import type { PanelOption } from "@/server/services/student-panel";

/**
 * Selector de materia de arriba ("Costos de proyectos ▾"). Con una sola opción no hay nada que
 * elegir: se muestra solo el nombre. `next` es la pantalla del panel a la que vuelve.
 */
export function CourseSelector({ options, current, next }: { options: PanelOption[]; current: PanelOption; next: string }) {
  if (options.length < 2) {
    return <h1 className="text-xl font-bold text-ink sm:text-2xl">{current.label}</h1>;
  }
  return (
    <details className="group relative">
      <summary
        className="flex min-h-11 cursor-pointer list-none items-center gap-1 rounded-xl px-2 text-xl font-bold text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary sm:text-2xl [&::-webkit-details-marker]:hidden"
        aria-label={`${TEXT.student.selector.label}: ${current.label}`}
      >
        <h1 className="inline">{current.label}</h1>
        <ChevronDown className="size-5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <ul className="absolute left-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1 shadow-lg">
        {options.map((o) => (
          <li key={o.folderId}>
            <form action={selectFolderAction.bind(null, o.folderId, next)}>
              <button
                type="submit"
                aria-current={o.folderId === current.folderId ? "true" : undefined}
                className="flex min-h-11 w-full items-center rounded-lg px-3 text-left text-base text-ink hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-primary aria-[current=true]:font-semibold"
              >
                {o.label}
              </button>
            </form>
          </li>
        ))}
      </ul>
    </details>
  );
}
