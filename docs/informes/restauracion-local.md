# Prueba de restauración en local

15 de noviembre de 2026 · Claude Code

## Qué se hizo

Backup de la base de los flujos de punta a punta (`educai_e2e`), con los datos sintéticos que dejaron las pruebas de carga de la etapa 6, y restauración en una base vacía del mismo servidor (PostgreSQL 16 con pgvector):

```bash
DATABASE_URL=postgresql://educai:educai@localhost:5432/educai_e2e scripts/backup-db.sh /tmp/prueba.dump
```

```bash
RESTORE_ADMIN_URL=postgresql://educai:educai@localhost:5432/postgres RESTORE_COMPARE_URL=postgresql://educai:educai@localhost:5432/educai_e2e scripts/restore-check.sh /tmp/prueba.dump
```

## Resultado

| Paso | Resultado |
| --- | --- |
| Backup | 1,1 MB en 0,3 s |
| Suma de verificación | ok |
| Restauración en base vacía | menos de 1 s |
| Migraciones | al día con el código |
| Filas por tabla | iguales al origen: 25.563 filas en 45 tablas |
| La app arranca con la base restaurada | `/api/health` devuelve `ok: true` con la migración `20261115060000_carpeta_proyecto_unica`, y `/login` responde |
| Total | 9 s |

Un backup alterado a propósito se rechaza: con el archivo `.sha256`, por la suma de verificación; sin él, `pg_restore` corta con error y el script termina con código 1.

## Qué falta

La misma prueba en producción, con el backup diario del proveedor, una vez creada la base (procedimiento en `docs/ENTORNOS_Y_DESPLIEGUE.md`). La base de producción del piloto va a ser mucho más chica que esta durante el primer cuatrimestre, así que los tiempos no deberían cambiar de orden.
