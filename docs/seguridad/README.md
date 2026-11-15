# Paquete para la revisión de seguridad (etapa 6)

15 de noviembre de 2026 · Preparado por Claude Code para la persona que haga la revisión

> **Estado:** Tomás decidió no hacer la revisión de seguridad externa (2026-11-15). El mapa de permisos y los puntos a revisar quedan como referencia y se mantienen al día con el código.

El spec pide una revisión de seguridad hecha por una persona antes del piloto, con foco en permisos. La IA que escribió el código no debería ser la única que lo audita, así que este paquete no es una revisión: es el mapa para que la revisión sea rápida y no se le escape nada.

## Qué se protege

Conversaciones de estudiantes universitarios con una IA, y lo que se deriva de ellas (dudas por tema, fragmentos textuales como evidencia, conclusiones, contexto). El docente de la cátedra ve a sus estudiantes con nombre, solo si dieron consentimiento, y cada apertura queda registrada. El error más grave posible es que alguien vea datos de un estudiante que no debería.

## Documentos

| Documento | Contenido |
| --- | --- |
| [`mapa-de-permisos.md`](mapa-de-permisos.md) | Roles, funciones de la capa de permisos, cada página, ruta y acción con su control, y las reglas V1 a V15 con su test |
| [`puntos-a-revisar.md`](puntos-a-revisar.md) | Lo que conviene mirar con más cuidado, incluidos los hallazgos ya corregidos |
| `docs/SPEC.md`, sección "Reglas de visibilidad y permisos" | La política: V1 a V15 |
| `docs/legal/tratamiento-de-datos.md` | Qué datos hay, quién los ve y con qué proveedores |

## Cómo levantar el entorno

Con Docker o un PostgreSQL 16 con pgvector:

```bash
scripts/bootstrap.sh
```

```bash
npm run db:seed
```

```bash
npm run dev
```

El seed crea una cátedra, un docente y estudiantes sintéticos con contraseñas que imprime en la consola. Con `AI_PROVIDER=scripted` la app funciona sin clave de Anthropic.

Para correr los tests de permisos contra una base de prueba:

```bash
TEST_DATABASE_URL=postgresql://educai:educai@localhost:5432/educai_test npm test -- tests/integration/visibility
```

## Qué se espera de la revisión

1. Recorrer el mapa de permisos y confirmar, en el código, que cada página, ruta y acción hace lo que dice.
2. Intentar romper las reglas V1 a V15 con la app levantada: cambiar ids en las URL, llamar acciones con ids ajenos, retirar el consentimiento y volver a las pantallas del docente, usar los chats para pedir datos de otros.
3. Mirar los puntos de `puntos-a-revisar.md`.
4. Anotar cada hallazgo con la plantilla de abajo, en un issue o en un archivo `docs/seguridad/hallazgos.md`.

### Plantilla de hallazgo

```
Título:
Gravedad: crítica / alta / media / baja
Regla afectada (V1 a V15, si aplica):
Cómo reproducirlo:
Qué debería pasar:
Archivo y línea:
```

Cada hallazgo de gravedad alta o crítica se corrige con un test que lo reproduce antes del arreglo, como pide `docs/PRUEBAS.md`.

## Cierre

| Campo | Valor |
| --- | --- |
| Revisó | |
| Fecha | |
| Versión revisada (commit) | |
| Resultado | Aprobada / Aprobada con observaciones / No aprobada |
| Hallazgos abiertos | |

La firma la confirma Tomás en `docs/PROGRESO.md`. Claude Code no marca esta casilla.
