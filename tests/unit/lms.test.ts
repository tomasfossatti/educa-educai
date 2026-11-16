import { describe, expect, it } from "vitest";
import { embeddedReadings, htmlToText, matchCourse, materialFileName, normalizeName, parseLmsCommand, parseRiseCourse, planImport } from "@/domain/lms";

describe("parseLmsCommand", () => {
  it.each([
    ['crea la materia "costos de proyectos"', "costos de proyectos"],
    ["creá la materia «Costos de Proyectos»", "Costos de Proyectos"],
    ["Creá la materia costos de proyectos", "costos de proyectos"],
    ["armame la materia Costos de proyectos desde Canvas", "Costos de proyectos"],
    ["importá el curso de Gestión de Proyectos del LMS.", "Gestión de Proyectos"],
    ["traé la materia: Estrategia y Validación de Negocios", "Estrategia y Validación de Negocios"],
    ["descargá 'Costos de proyectos'", "Costos de proyectos"],
  ])("«%s» pide crear «%s»", (message, name) => {
    expect(parseLmsCommand(message)).toEqual({ action: "create_subject", courseName: name });
  });

  it.each(["¿qué materias tengo?", "listame mis materias del LMS", "Cuáles materias hay en Canvas"])("«%s» pide la lista", (message) => {
    expect(parseLmsCommand(message)).toEqual({ action: "list_courses" });
  });

  it.each(["hola", "¿cómo funciona esto?", "crea algo lindo", ""])("«%s» no es un pedido reconocible", (message) => {
    expect(parseLmsCommand(message)).toEqual({ action: "none" });
  });
});

describe("matchCourse", () => {
  const courses = [
    { id: "1", name: "Costos de Proyectos", code: "CP-2026" },
    { id: "2", name: "Gestión de Proyectos", code: "GP" },
    { id: "3", name: "Contabilidad de Costos I", code: "CC1" },
  ];

  it("encuentra la materia sin importar mayúsculas ni tildes", () => {
    expect(matchCourse("costos de proyectos", courses)).toEqual({ kind: "found", course: courses[0] });
    expect(matchCourse("GESTION DE PROYECTOS", courses)).toEqual({ kind: "found", course: courses[1] });
  });

  it("acepta el código de la materia", () => {
    expect(matchCourse("cp-2026", courses)).toEqual({ kind: "found", course: courses[0] });
  });

  it("encuentra por parte del nombre cuando hay una sola", () => {
    expect(matchCourse("contabilidad", courses)).toEqual({ kind: "found", course: courses[2] });
  });

  it("pide elegir cuando varias se parecen igual", () => {
    const result = matchCourse("proyectos", courses);
    expect(result.kind).toBe("ambiguous");
    if (result.kind === "ambiguous") expect(result.candidates.map((c) => c.id).sort()).toEqual(["1", "2"]);
  });

  it("dice que no está cuando nada se parece", () => {
    expect(matchCourse("física cuántica", courses)).toEqual({ kind: "not_found" });
  });
});

describe("htmlToText", () => {
  it("saca etiquetas, scripts y entidades y respeta los párrafos", () => {
    const html = "<style>p{}</style><h1>Costos</h1><p>Fijos &amp; variables</p><script>alert(1)</script><ul><li>Uno</li><li>Dos</li></ul><p>Acci&oacute;n&nbsp;y m&#225;s</p>";
    expect(htmlToText(html)).toBe("Costos\nFijos & variables\n- Uno\n- Dos\nAcción y más");
  });
});

describe("embeddedReadings (formato Siglo 21)", () => {
  const body =
    '<div id="lectura1m1"><a>L1</a></div><div id="lectura1m1"><iframe src="https://meca.ues21.edu.ar/m1/l1/index.html?x=1&amp;y=2"></iframe></div>' +
    '<div id="lectura2m1"><iframe src="https://otro.sitio.com/l2/"></iframe></div>' +
    '<div id="lectura1m2"><iframe src="https://meca.ues21.edu.ar/m2/l1/"></iframe></div>';

  it("devuelve solo las lecturas de los servidores permitidos, en orden y sin parámetros", () => {
    expect(embeddedReadings(body, ["meca.ues21.edu.ar"])).toEqual([
      { module: 1, reading: 1, url: "https://meca.ues21.edu.ar/m1/l1/index.html" },
      { module: 2, reading: 1, url: "https://meca.ues21.edu.ar/m2/l1/" },
    ]);
  });

  it("no acepta http salvo que se permita", () => {
    const http = '<div id="lectura1m1"><iframe src="http://meca.ues21.edu.ar/x/"></iframe></div>';
    expect(embeddedReadings(http, ["meca.ues21.edu.ar"])).toEqual([]);
    expect(embeddedReadings(http, ["meca.ues21.edu.ar"], true)).toHaveLength(1);
  });
});

describe("parseRiseCourse", () => {
  it("decodifica el texto y los adjuntos de una lectura interactiva", () => {
    const data = { title: "Lectura", lessons: [{ title: "Intro", items: [{ heading: "Tema", text: "<p>Hola <b>mundo</b></p>" }], media: { attachment: { originalUrl: "assets/a.pdf" } } }] };
    const html = `<script>window.courseData = "${Buffer.from(JSON.stringify(data)).toString("base64")}";</script>`;
    const parsed = parseRiseCourse(html, "https://meca.ues21.edu.ar/m1/index.html");
    expect(parsed?.text).toContain("Hola mundo");
    expect(parsed?.attachments).toEqual(["https://meca.ues21.edu.ar/m1/assets/a.pdf"]);
  });

  it("devuelve null si la página no es una lectura interactiva", () => {
    expect(parseRiseCourse("<p>hola</p>", "https://x.com/")).toBeNull();
  });
});

describe("planImport", () => {
  const item = (module: string, n: number, key = `${module}-${n}`) => ({ module, title: `L${n}`, kind: "file" as const, key });

  it("respeta el orden, saca repetidos y cuenta los módulos con contenido", () => {
    const plan = planImport([
      { name: "M1", items: [item("M1", 1), item("M1", 2)] },
      { name: "M2", items: [] },
      { name: "M3", items: [item("M3", 1), item("M3", 9, "M1-1")] },
    ]);
    expect(plan.items.map((i) => i.key)).toEqual(["M1-1", "M1-2", "M3-1"]);
    expect(plan.modules).toBe(2);
    expect(plan.skipped).toBe(0);
  });

  it("corta en el tope", () => {
    const plan = planImport([{ name: "M", items: [1, 2, 3, 4].map((n) => item("M", n)) }], 3);
    expect(plan.items).toHaveLength(3);
    expect(plan.skipped).toBe(1);
  });
});

describe("materialFileName y normalizeName", () => {
  it("arma el nombre con módulo y título, sin caracteres inválidos", () => {
    expect(materialFileName("Módulo 1: Fundamentos", "Costos / fijos", "pdf")).toBe("Módulo 1  Fundamentos · Costos fijos.pdf".replace("  ", " "));
    expect(materialFileName("M", "Lectura.pdf", ".pdf")).toBe("M · Lectura.pdf");
  });

  it("normaliza nombres", () => {
    expect(normalizeName("  Gestión   de PROYECTOS! ")).toBe("gestion de proyectos");
  });
});
