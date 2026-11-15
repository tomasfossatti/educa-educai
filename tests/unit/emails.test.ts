import { describe, expect, it } from "vitest";
import { extractEmails } from "@/lib/emails";

describe("extractEmails", () => {
  it("toma solo los emails de un CSV con otras columnas, sin duplicados", () => {
    const csv = 'nombre,email,legajo\n"Pérez, Ana",Ana@Uni.edu,123\nBruno Díaz;bruno@uni.edu;456\nAna,ana@uni.edu,123';
    expect(extractEmails(csv)).toEqual(["ana@uni.edu", "bruno@uni.edu"]);
  });
  it("acepta una lista separada por comas o saltos de línea", () => {
    expect(extractEmails("a@x.com, b@x.com\nc@x.com")).toEqual(["a@x.com", "b@x.com", "c@x.com"]);
  });
  it("devuelve vacío si no hay emails", () => {
    expect(extractEmails("Ana, Bruno")).toEqual([]);
  });
});
