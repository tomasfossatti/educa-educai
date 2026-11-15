import { describe, expect, it } from "vitest";
import { isPublicPath, sitePasswordMatches } from "@/lib/site-password";

const basic = (user: string, pass: string) => `Basic ${btoa(`${user}:${pass}`)}`;

describe("contraseña de sitio de staging", () => {
  it("acepta la contraseña correcta con cualquier usuario", () => {
    expect(sitePasswordMatches(basic("educai", "s3creta"), "s3creta")).toBe(true);
    expect(sitePasswordMatches(basic("", "s3creta"), "s3creta")).toBe(true);
  });

  it("rechaza contraseña incorrecta, encabezado ausente o mal formado", () => {
    expect(sitePasswordMatches(basic("educai", "otra"), "s3creta")).toBe(false);
    expect(sitePasswordMatches(null, "s3creta")).toBe(false);
    expect(sitePasswordMatches("Bearer s3creta", "s3creta")).toBe(false);
    expect(sitePasswordMatches("Basic %%%", "s3creta")).toBe(false);
    expect(sitePasswordMatches(`Basic ${btoa("sin-dos-puntos")}`, "s3creta")).toBe(false);
  });

  it("solo el chequeo de salud queda sin contraseña", () => {
    expect(isPublicPath("/api/health")).toBe(true);
    expect(isPublicPath("/login")).toBe(false);
    expect(isPublicPath("/api/health/x")).toBe(false);
  });
});
