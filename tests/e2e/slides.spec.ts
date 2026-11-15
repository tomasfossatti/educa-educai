import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import JSZip from "jszip";
import { makePdf } from "./documents";
import { login, world } from "./support";

test("el docente arma, edita, aprueba y descarga los slides de una clase; la estudiante ve la próxima clase", async ({ browser }) => {
  const w = await world();
  const teacher = await browser.newPage();
  await login(teacher, w.teacher);
  await teacher.goto(`/t/courses/${w.course.id}/material`);
  await teacher.waitForLoadState("networkidle");
  await teacher.setInputFiles("input[type=file]", {
    name: "programa.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(makePdf(["Unidad 2. Una hipotesis falsable define el resultado que la refutaria."])),
  });
  await teacher.getByRole("button", { name: "Subir e indexar" }).click();
  await expect(teacher.getByText("programa.pdf quedó indexado")).toBeVisible();

  await teacher.goto(`/t/courses/${w.course.id}/clases`);
  await teacher.waitForLoadState("networkidle");
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  await teacher.fill("input[name=date]", tomorrow);
  await teacher.getByLabel("Hipotesis falsables").check();
  await teacher.fill("input[name=objective]", "Formular hipótesis con métrica, umbral y plazo");
  await teacher.getByRole("button", { name: "Agregar clase" }).click();
  await teacher.getByRole("link", { name: /Hipotesis falsables/ }).click();
  await teacher.waitForURL(/\/clases\/[^/]+$/);
  await teacher.waitForLoadState("networkidle");

  await teacher.getByRole("button", { name: "Generar borrador de slides" }).click();
  await expect(teacher.getByText("Fuente: programa.pdf, pág. 1").first()).toBeVisible();
  await expect(teacher.getByText("Ejercicio de 5 minutos")).toBeVisible();
  await expect(teacher.getByText("Pregunta de chequeo")).toBeVisible();

  await teacher.fill("#title0", "Hipótesis que se pueden refutar");
  await teacher.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(teacher.getByText("Cambios guardados")).toBeVisible();
  await teacher.getByRole("button", { name: "Aprobar" }).click();
  await expect(teacher.getByText(/Aprobada el/)).toBeVisible();

  const [download] = await Promise.all([teacher.waitForEvent("download"), teacher.getByRole("link", { name: "Descargar PowerPoint" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^slides-.*\.pptx$/);
  const zip = await JSZip.loadAsync(readFileSync((await download.path())!));
  const slide = await zip.file("ppt/slides/slide2.xml")!.async("string");
  expect(slide).toContain("Hipótesis que se pueden refutar");
  expect(slide).toContain("Fuente: programa.pdf, pág. 1");

  const student = await browser.newPage();
  await login(student, w.students[0]);
  await expect(student.getByText(/Próxima clase .*Hipotesis falsables/)).toBeVisible();
  await expect(student.getByText("Formular hipótesis con métrica, umbral y plazo")).toBeVisible();
});
