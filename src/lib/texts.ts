/**
 * Textos de la interfaz en español rioplatense, centralizados para poder traducirlos (regla 8).
 * Las pantallas nuevas toman sus textos de acá; las existentes se migran a medida que se tocan.
 */
export const TEXT = {
  material: {
    nav: "Material",
    title: "Material de la cátedra",
    description:
      "Los archivos que la IA usa para responder en las carpetas de tus estudiantes. Cada respuesta cita el archivo y la página.",
    uploadLabel: "Subir archivo",
    uploadHint: "PDF, DOCX, PPTX o TXT, hasta 20 MB. Si subís otra vez un archivo con el mismo nombre, queda como versión nueva.",
    uploadButton: "Subir e indexar",
    uploading: "Indexando…",
    empty: "Todavía no cargaste material.",
    emptyHint: "Subí el programa, apuntes o presentaciones para que el chat pueda citarlos.",
    status: { PROCESSING: "Procesando", READY: "Listo", FAILED: "Con error" },
    pages: (n: number) => `${n} ${n === 1 ? "página" : "páginas"}`,
    fragments: (n: number) => `${n} ${n === 1 ? "fragmento" : "fragmentos"}`,
    version: (v: number) => `versión ${v}`,
    uploaded: (fileName: string, pages: number) => `Listo: ${fileName} quedó indexado (${pages} ${pages === 1 ? "página" : "páginas"}).`,
    noFile: "Elegí un archivo.",
  },
} as const;
