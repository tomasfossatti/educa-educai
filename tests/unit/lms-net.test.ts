import { afterEach, describe, expect, it } from "vitest";
import { assertPublicHost, normalizeBaseUrl } from "@/server/lms/net";
import { decryptSecret, encryptSecret } from "@/server/lms/crypto";

describe("direcciones del LMS (sin SSRF)", () => {
  afterEach(() => {
    delete process.env.LMS_ALLOW_INSECURE_URLS;
  });

  it("normaliza la dirección y exige https", () => {
    expect(normalizeBaseUrl("campus.uni.edu.ar/")).toBe("https://campus.uni.edu.ar");
    expect(normalizeBaseUrl("https://uni.instructure.com/moodle/")).toBe("https://uni.instructure.com/moodle");
    expect(() => normalizeBaseUrl("http://campus.uni.edu.ar")).toThrow(/https/);
    expect(() => normalizeBaseUrl("https://user:pass@campus.uni.edu.ar")).toThrow();
    expect(() => normalizeBaseUrl("")).toThrow();
  });

  it.each(["https://127.0.0.1/", "https://10.1.2.3/", "https://192.168.0.10/", "https://169.254.169.254/latest", "https://[::1]/", "https://localhost/", "https://db.internal/"])(
    "rechaza %s",
    async (url) => {
      await expect(assertPublicHost(new URL(url))).rejects.toThrow();
    },
  );

  it("permite http y localhost solo con el permiso de los tests", async () => {
    process.env.LMS_ALLOW_INSECURE_URLS = "true";
    expect(normalizeBaseUrl("http://localhost:4100")).toBe("http://localhost:4100");
    await expect(assertPublicHost(new URL("http://localhost:4100"))).resolves.toBeUndefined();
  });
});

describe("cifrado de la credencial", () => {
  it("cifra y descifra, y cada cifrado es distinto", () => {
    const a = encryptSecret("token-sintetico");
    const b = encryptSecret("token-sintetico");
    expect(a).not.toContain("token-sintetico");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("token-sintetico");
  });

  it("detecta una credencial alterada", () => {
    const sealed = encryptSecret("token-sintetico").split(".");
    sealed[3] = Buffer.from("otra cosa").toString("base64");
    expect(() => decryptSecret(sealed.join("."))).toThrow();
  });
});
