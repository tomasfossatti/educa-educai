-- Una sola carpeta de proyecto por estudiante (índice único parcial). Evita duplicados cuando
-- dos pedidos crean las carpetas a la vez. Si ya hubiera duplicados, se conserva la más antigua
-- y sus conversaciones y contexto se mueven a ella (no se borra ningún dato).
WITH ranked AS (
  SELECT "id", "studentId", ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY "createdAt", "id") AS n,
         FIRST_VALUE("id") OVER (PARTITION BY "studentId" ORDER BY "createdAt", "id") AS keep
  FROM "Folder" WHERE "kind" = 'PROJECT'
)
UPDATE "AIConversation" a SET "folderId" = r.keep FROM ranked r WHERE a."folderId" = r."id" AND r.n > 1;

WITH ranked AS (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY "createdAt", "id") AS n,
         FIRST_VALUE("id") OVER (PARTITION BY "studentId" ORDER BY "createdAt", "id") AS keep
  FROM "Folder" WHERE "kind" = 'PROJECT'
)
UPDATE "FolderContext" c SET "folderId" = r.keep FROM ranked r WHERE c."folderId" = r."id" AND r.n > 1;

DELETE FROM "Folder" f USING (
  SELECT "id", ROW_NUMBER() OVER (PARTITION BY "studentId" ORDER BY "createdAt", "id") AS n FROM "Folder" WHERE "kind" = 'PROJECT'
) r WHERE f."id" = r."id" AND r.n > 1;

CREATE UNIQUE INDEX "Folder_one_project_per_student" ON "Folder" ("studentId") WHERE "kind" = 'PROJECT';
