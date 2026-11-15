# Autonomía de Claude Code en Educai

Este documento define qué hace Claude Code solo, qué necesita a Tomás y por qué. La idea es que Tomás intervenga pocas veces y que cada intervención sea corta y concreta.

## Principio

Claude Code tiene libertad total dentro de un perímetro: el contenedor de desarrollo, la base de datos local, el entorno de staging y los datos sintéticos. Producción queda afuera de ese perímetro porque sus credenciales nunca están en el contenedor. Con esa separación, un error del agente no puede tocar datos reales aunque quiera.

## Cómo se lanza

1. Abrir el repositorio en el contenedor de `.devcontainer/` (VS Code, Codespaces o `devcontainer up`).
2. Dentro del contenedor, correr `claude --permission-mode bypassPermissions`. Ese modo se pasa por línea de comandos o se guarda en la configuración de usuario, porque los archivos del proyecto no lo aplican. En el contenedor es razonable porque no hay nada valioso que proteger fuera del repositorio.
3. Si Tomás prefiere más control, `claude --permission-mode acceptEdits` usa las listas de `.claude/settings.json` y solo pregunta por lo que está en `ask`.

## Qué hace solo

- Leer, escribir y borrar código, migraciones, tests, documentación y fábricas de datos.
- Instalar dependencias, correr lint, tipos, tests, build y pruebas de punta a punta con Playwright.
- Levantar y reiniciar la base local, crear bases de prueba, aplicar migraciones, resetear datos locales.
- Crear usuarios, cátedras, contraseñas y conversaciones sintéticas de prueba, sin límite, en local, CI y staging.
- Generar secretos para local y staging con `openssl rand` y guardarlos en `.secrets/` o en las variables del proveedor.
- Crear ramas, commits y pull requests, esperar el CI, corregir lo que falle y fusionar a `main` cuando todo esté en verde.
- Desplegar a staging, que se actualiza solo con cada fusión a `main`.
- Cargar secretos en GitHub y en el proveedor con sus CLIs, usando los tokens que Tomás entregó (ver `CUENTAS_Y_SECRETOS.md`).
- Llamar a la API de Claude con la clave de desarrollo, dentro del tope de gasto configurado.
- Decidir lo que el spec no define, dejando la decisión escrita en `DECISIONES.md`.

## Qué necesita a Tomás

| Paso | Por qué no lo puede hacer Claude Code | Cuánto lleva |
| --- | --- | --- |
| Crear las cuentas raíz (GitHub, proveedor de hosting, consola de Anthropic) y generar los tokens | Piden verificación de identidad, correo, a veces CAPTCHA, doble factor y aceptar términos que obligan a una persona | 45 a 60 minutos, una vez |
| Cargar medio de pago y fijar el tope de gasto mensual en cada servicio | Es una decisión financiera con consecuencias legales | 10 minutos |
| Aprobar el despliegue a producción | Producción tiene datos de personas reales. Se configura como entorno protegido en GitHub con Tomás como revisor | 1 clic por despliegue |
| Aprobar migraciones que borran o transforman datos en producción | Una migración destructiva no se deshace | Al revisar el PR |
| Abogado: aviso de consentimiento y convenio (Ley 25.326) | Es una obligación legal y requiere un profesional | Etapa 6 |
| Revisión de seguridad por una persona, con foco en permisos | La IA que escribe el código no debería ser la única que lo audita | Etapa 6 |
| Dar de alta la primera cátedra real, el docente y los estudiantes | Son personas reales que tienen que aceptar participar | Piloto |
| Cambiar el alcance del producto | El spec es de Tomás | Cuando haga falta |

## Cuándo frena y pregunta

Claude Code se detiene y deja un mensaje claro en `docs/PROGRESO.md` cuando ocurre alguna de estas cosas:

- Un test de las reglas V1 a V15 falla y la causa no es evidente.
- Una tarea exige tocar algo de producción o usar datos reales.
- El gasto de IA de una sesión pasa del tope diario que fija `CUENTAS_Y_SECRETOS.md`.
- Hace falta una cuenta o servicio nuevo que no figura en el inventario.
- Una decisión cambia el alcance, el modelo de datos de forma incompatible o la política de visibilidad.

## Reglas de seguridad que el agente respeta aunque pueda saltarlas

- No usa `--no-verify`, no desactiva tests ni baja una regla de permisos para destrabarse.
- No commitea secretos. Si uno se filtra, lo rota y lo anota.
- No copia datos de producción a ningún otro entorno.
- No pega contenido de conversaciones de estudiantes en logs, issues ni mensajes de commit.

## Revisión periódica

Una vez por etapa, Tomás lee `PROGRESO.md` y `DECISIONES.md` (diez minutos) y corrige el rumbo si hace falta. Esa lectura es la supervisión continua del proyecto.
