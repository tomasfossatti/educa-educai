import { describe, expect, it } from "vitest";
import { decodeExtensionCode, encodeExtensionCode, looksLikeUrl } from "@/domain/lms";
import { isPublicPath } from "@/lib/site-password";
// El mismo formato lo decodifica la extensión: se prueba que los dos lados coinciden.
import { decodeCode, originsFor } from "../../extension/codigo.js";

const secret = "s".repeat(32);

describe("código de vinculación de la extensión", () => {
  it("ida y vuelta, en el servidor y en la extensión", () => {
    const code = encodeExtensionCode({ server: "https://educai-staging.vercel.app", canvas: "https://siglo21.instructure.com", secret });
    expect(code.startsWith("educai1.")).toBe(true);
    expect(decodeExtensionCode(code)).toEqual({ server: "https://educai-staging.vercel.app", canvas: "https://siglo21.instructure.com", secret });
    const ext = decodeCode(code);
    expect(ext).toMatchObject({ server: "https://educai-staging.vercel.app", canvas: "https://siglo21.instructure.com", secret });
    expect(originsFor(ext)).toEqual(["https://educai-staging.vercel.app/*", "https://siglo21.instructure.com/*"]);
  });

  it("acepta espacios alrededor y rechaza lo que no es un código", () => {
    const code = encodeExtensionCode({ server: "https://a.com", canvas: "https://b.com", secret });
    expect(decodeExtensionCode(`  ${code}\n`)).not.toBeNull();
    for (const bad of ["", "hola", "https://mcp-siglo.vercel.app/mcp/abc", "educai1.no-es-json", code.slice(0, 20)]) {
      expect(decodeExtensionCode(bad)).toBeNull();
      expect(decodeCode(bad)).toBeNull();
    }
  });

  it("rechaza http salvo localhost y secretos cortos", () => {
    const http = encodeExtensionCode({ server: "http://educai.com", canvas: "https://b.com", secret });
    expect(decodeExtensionCode(http)).toBeNull();
    expect(decodeCode(http)).toBeNull();
    const local = encodeExtensionCode({ server: "http://localhost:3200", canvas: "http://localhost:4310", secret });
    expect(decodeCode(local)?.server).toBe("http://localhost:3200");
    expect(decodeExtensionCode(encodeExtensionCode({ server: "https://a.com", canvas: "https://b.com", secret: "corto" }))).toBeNull();
  });

  it("reconoce un link pegado en lugar de la credencial", () => {
    expect(looksLikeUrl("https://mcp-siglo.vercel.app/mcp/d5f3")).toBe(true);
    expect(looksLikeUrl("abc123")).toBe(false);
  });

  it("las rutas de la extensión no piden la contraseña de staging; el resto sí", () => {
    expect(isPublicPath("/api/lms/extension/link")).toBe(true);
    expect(isPublicPath("/api/lms/extension/sync")).toBe(true);
    expect(isPublicPath("/api/lms/extension")).toBe(false);
    expect(isPublicPath("/t/asistente")).toBe(false);
  });
});
