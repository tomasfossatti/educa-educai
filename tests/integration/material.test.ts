/** Carga e indexación de material con archivo y página, y búsqueda en español. Requiere TEST_DATABASE_URL. */
import { beforeAll, describe, expect, it } from "vitest";
import { makePdf, makePptx } from "../support/documents";
import { factories } from "../support/factories";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("material de la cátedra (integración)", () => {
  let db: typeof import("@/server/db").db;
  let material: typeof import("@/server/services/material");
  let courseId: string;
  let otherCourseId: string;
  let teacherId: string;

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    ({ db } = await import("@/server/db"));
    material = await import("@/server/services/material");
    const f = factories(db);
    const t = await f.teacher();
    teacherId = t.id;
    courseId = (await f.course(t.id)).id;
    otherCourseId = (await f.course(t.id)).id;
  });

  it("indexa un PDF por página y encuentra el fragmento con su archivo y página", async () => {
    const pdf = makePdf([
      "Unidad 1. Segmentacion de clientes y propuesta de valor.",
      "Unidad 2. Una hipotesis falsable define el resultado que la refutaria, con metrica, umbral y plazo.",
    ]);
    const m = await material.ingestMaterial({ courseId, uploadedById: teacherId, fileName: "programa.pdf", mimeType: "application/pdf", data: pdf });
    expect(m.status).toBe("READY");
    expect(m.pageCount).toBe(2);

    const hits = await material.searchMaterial(courseId, "¿Qué hace falsable a una hipótesis?");
    expect(hits[0]).toMatchObject({ fileName: "programa.pdf", page: 2 });
    expect(hits[0].text).toContain("falsable");
  });

  it("indexa un PPTX por diapositiva", async () => {
    const pptx = await makePptx([["Portada"], ["Experimentos de bajo costo", "Probar antes de invertir"]]);
    await material.ingestMaterial({
      courseId,
      uploadedById: teacherId,
      fileName: "clase-3.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      data: pptx,
    });
    const hits = await material.searchMaterial(courseId, "experimentos baratos de bajo costo");
    expect(hits[0]).toMatchObject({ fileName: "clase-3.pptx", page: 2 });
  });

  it("una subida nueva del mismo archivo es una versión nueva", async () => {
    const again = await material.ingestMaterial({ courseId, uploadedById: teacherId, fileName: "programa.pdf", mimeType: "application/pdf", data: makePdf(["Version corregida"]) });
    expect(again.version).toBe(2);
  });

  it("no mezcla material de otra cátedra", async () => {
    expect(await material.searchMaterial(otherCourseId, "hipótesis falsable")).toEqual([]);
  });

  it("sin coincidencias devuelve vacío, para que el chat avise que no hay fuente", async () => {
    expect(await material.searchMaterial(courseId, "fotosíntesis cloroplastos")).toEqual([]);
  });

  it("rechaza formatos no admitidos y deja en FAILED un archivo sin texto", async () => {
    await expect(
      material.ingestMaterial({ courseId, uploadedById: teacherId, fileName: "foto.png", mimeType: "image/png", data: new Uint8Array([1]) }),
    ).rejects.toThrow(/Formato no admitido/);
    const blank = await material.ingestMaterial({ courseId, uploadedById: teacherId, fileName: "vacio.txt", mimeType: "text/plain", data: new TextEncoder().encode("   ") });
    expect(blank.status).toBe("FAILED");
  });
});
