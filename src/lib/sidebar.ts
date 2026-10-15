export const OPEN_SIDEBAR_EVENT = "educai:open-sidebar";

export function triggerOpenSidebar() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(OPEN_SIDEBAR_EVENT));
  }
}
