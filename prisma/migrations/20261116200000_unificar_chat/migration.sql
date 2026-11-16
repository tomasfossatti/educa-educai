-- Un solo chat para el estudiante: el de la carpeta de la materia (ver DECISIONES.md, 2026-11-16).
-- Las conversaciones del tutor de la materia se creaban sin carpeta. Se asignan a la carpeta de su
-- materia, que se crea si falta. Solo agrega filas y completa una columna nula; no borra ni cambia
-- mensajes. Se puede correr más de una vez sin efecto.
INSERT INTO "Folder" ("id", "studentId", "kind", "name", "createdBy", "courseId", "createdAt", "updatedAt")
SELECT DISTINCT 'fld_' || md5(a."studentId" || a."courseId"), a."studentId", 'SUBJECT'::"FolderKind", c."name", 'SYSTEM'::"FolderCreator", a."courseId", now(), now()
FROM "AIConversation" a JOIN "Course" c ON c."id" = a."courseId"
WHERE a."folderId" IS NULL AND a."courseId" IS NOT NULL
ON CONFLICT DO NOTHING;

UPDATE "AIConversation" a SET "folderId" = f."id"
FROM "Folder" f
WHERE a."folderId" IS NULL AND a."courseId" IS NOT NULL AND f."studentId" = a."studentId" AND f."courseId" = a."courseId";
