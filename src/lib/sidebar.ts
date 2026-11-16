/** Carpeta del estudiante tal como se lista en la barra lateral. */
export interface SidebarFolder {
  id: string;
  name: string;
  kind: "SUBJECT" | "PROJECT";
}

/** Materia en la que está inscripto el estudiante, para la barra lateral. */
export interface SidebarCourse {
  id: string;
  name: string;
}

export const OPEN_SIDEBAR_EVENT = "educai:open-sidebar";

export function triggerOpenSidebar() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_SIDEBAR_EVENT));
  }
}
