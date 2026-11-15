import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { assertSafeZip } from "@/server/material/extract";

async function zipWith(files: Record<string, string>): Promise<Uint8Array> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) zip.file(name, content);
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}

describe("límite de tamaño de DOCX y PPTX", () => {
  it("acepta un archivo normal", async () => {
    const data = await zipWith({ "ppt/slides/slide1.xml": "<a:t>Hola</a:t>" });
    expect(() => assertSafeZip(data)).not.toThrow();
  });

  it("rechaza un archivo que descomprimido supera el límite, aunque comprimido sea chico", async () => {
    const data = await zipWith({ "ppt/slides/slide1.xml": "0".repeat(2 * 1024 * 1024) });
    expect(data.byteLength).toBeLessThan(50_000);
    expect(() => assertSafeZip(data, 1024 * 1024)).toThrow(/supera/);
  });

  it("rechaza algo que no es un ZIP", () => {
    expect(() => assertSafeZip(new TextEncoder().encode("no soy un zip"))).toThrow(/no es un archivo de Office/);
  });
});
