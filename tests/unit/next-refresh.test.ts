import { describe, expect, it, vi } from "vitest";

const nextRefresh = vi.fn();
vi.mock("next/cache", () => ({ refresh: () => nextRefresh() }));

const { refresh } = await import("@/server/next-refresh");

function outsideActionError() {
  return Object.assign(new Error("refresh can only be called from within a Server Action. See more info here: https://nextjs.org/docs/app/api-reference/functions/refresh"), {
    __NEXT_ERROR_CODE: "E870",
  });
}

describe("refresh al final de una acción", () => {
  it("llama al refresh de Next", () => {
    nextRefresh.mockReset();
    refresh();
    expect(nextRefresh).toHaveBeenCalledTimes(1);
  });

  it("tolera el error de fase (la página se renderiza igual) y no muestra un error al estudiante", () => {
    nextRefresh.mockReset().mockImplementation(() => {
      throw outsideActionError();
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(() => refresh()).not.toThrow();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("cualquier otro error se propaga", () => {
    nextRefresh.mockReset().mockImplementation(() => {
      throw new Error("otra cosa");
    });
    expect(() => refresh()).toThrow("otra cosa");
  });
});
