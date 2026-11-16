/** Carpeta del estudiante tal como se lista en la barra lateral. */
export interface SidebarFolder {
  id: string;
  name: string;
  kind: "SUBJECT" | "PROJECT";
}

export const OPEN_SIDEBAR_EVENT = "educai:open-sidebar";

export function triggerOpenSidebar() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_SIDEBAR_EVENT));
  }
}
