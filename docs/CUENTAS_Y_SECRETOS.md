# Cuentas, contraseñas y secretos

Este documento le dice a Claude Code qué cuentas existen, cómo se manejan las credenciales y qué hacer cuando necesita una nueva. Tomás crea las cuentas raíz una vez, y desde ahí Claude Code gestiona todo lo que cuelga de ellas.

## Inventario

| Servicio | Para qué | Quién la crea | Credencial que se entrega | Dónde vive |
| --- | --- | --- | --- | --- |
| Correo del proyecto (por ejemplo educai.dev@dominio) | Registrar todas las demás cuentas y recibir verificaciones | Tomás | Acceso de lectura por IMAP o reenvío a una carpeta | Gestor de contraseñas de Tomás |
| GitHub (organización o usuario) | Repositorio, CI, entornos protegidos | Tomás | Token de acceso fino con permisos sobre el repositorio de Educai: contenido, pull requests, workflows, secrets y variables, environments | `gh auth login` dentro del contenedor |
| Consola de Anthropic | Clave de API del producto y de pruebas | Tomás | Una clave de desarrollo y otra de staging, cada una en su propio workspace con tope mensual | `.secrets/local/` y variables de staging |
| Proveedor de hosting y base (Render u otro) | Staging y producción con PostgreSQL gestionado | Tomás | Token de API con permiso sobre el proyecto de staging. El de producción lo guarda solo Tomás | Variable del contenedor para staging |
| Dominio y DNS | Dirección pública | Tomás | Acceso delegado cuando llegue la etapa 6 | Gestor de contraseñas de Tomás |
| Servicio de correo transaccional (invitaciones) | Enviar invitaciones y avisos | Claude Code, con la cuenta del correo del proyecto, si el servicio lo permite sin verificación humana | Clave de API | Variables de staging y producción |

Si una cuenta que Claude Code necesita no figura acá, la agrega a la tabla con una nota en `PROGRESO.md` y le pide a Tomás que la cree.

## Qué puede hacer Claude Code con cuentas

- Registrarse en un servicio cuando el registro lo permite sin intervención humana, usando el correo del proyecto. Si aparece un CAPTCHA, un código por SMS o una verificación de identidad, para y pide ayuda.
- Crear proyectos, bases, servicios y variables dentro de las cuentas raíz, con los tokens recibidos.
- Rotar claves y contraseñas que él mismo generó.
- No usa medios de pago ni sube un plan de cobro sin aprobación de Tomás.

## Contraseñas y usuarios

- Las contraseñas las genera Claude Code con `openssl rand -base64 24` y nunca con valores inventados o repetidos.
- Cada entorno tiene su carpeta en `.secrets/` (`local`, `staging`, `prod`). Todas están en `.gitignore`.
- `.secrets/prod/` queda siempre vacía en el contenedor. Los secretos de producción los carga Tomás en el proveedor, o Claude Code los escribe sin poder leerlos de vuelta (comando de solo escritura), y la configuración le niega la lectura.
- Los usuarios de prueba (estudiantes, docentes, administrador) se crean con las fábricas de `tests/support`. Sus contraseñas se generan en cada ejecución y no se guardan en el código. El usuario de demo con contraseña pública que trae educa-educai se elimina en la etapa 2.
- Los usuarios reales del piloto se crean únicamente en producción, por invitación, y nadie del equipo técnico conoce sus contraseñas.

## Reglas de manejo de secretos

1. Un secreto nunca aparece en el código, en un commit, en un log, en un issue ni en un PR.
2. `.env.example` lista todas las variables con valores vacíos o de ejemplo inofensivos. Cada variable nueva se agrega ahí en el mismo PR que la usa.
3. Si un secreto se filtra, se rota de inmediato, se anota en `PROGRESO.md` y se revisa el historial con `git log -S`.
4. El CI usa un secreto de sesión descartable y el proveedor de IA guionado. La clave real de Anthropic nunca está en el CI de los pull requests.
5. Las pruebas con la IA real corren a mano o en un trabajo programado que usa la clave de staging, con tope de gasto.

## Topes de gasto

| Concepto | Tope sugerido | Dónde se configura |
| --- | --- | --- |
| API de Anthropic, desarrollo | 50 USD por mes | Consola de Anthropic, límite del workspace |
| API de Anthropic, staging | 100 USD por mes | Consola de Anthropic, límite del workspace |
| Hosting de staging | 30 USD por mes | Proveedor |
| Gasto de IA en una sola sesión de Claude Code | 15 USD | Se registra en `AIUsageEvent` y se revisa en `PROGRESO.md` |

Son valores de partida para que Tomás ajuste según su presupuesto. Pasados esos topes Claude Code no sigue sin aviso.

## Checklist de arranque para Tomás

- [ ] Crear el correo del proyecto y guardar sus datos en el gestor de contraseñas.
- [ ] Crear la cuenta de GitHub y el repositorio, generar el token fino y cargarlo con `gh auth login`.
- [ ] Activar protección de la rama `main` (PR obligatorio y CI en verde) y crear el entorno `production` con Tomás como revisor requerido.
- [ ] Crear dos workspaces en la consola de Anthropic con sus topes, y generar una clave por workspace.
- [ ] Crear la cuenta del proveedor de hosting, el proyecto de staging y un token con permiso solo sobre staging.
- [ ] Colocar las claves en `.secrets/local/` y en las variables del contenedor.
- [ ] Anotar en `PROGRESO.md` que el checklist está completo.
