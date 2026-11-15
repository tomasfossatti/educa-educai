# Documentos para la revisión legal (etapa 6)

15 de noviembre de 2026 · Preparado por Claude Code para Tomás y el abogado

El spec pide que el aviso de consentimiento y el convenio del piloto los revise un abogado, en el marco de la Ley 25.326 de Protección de Datos Personales. Estos documentos describen lo que la app hace hoy, verificado contra el código, para que la revisión parta de hechos y no de intenciones. No son un dictamen ni reemplazan la opinión del abogado.

| Documento | Para qué |
| --- | --- |
| [`aviso-de-consentimiento.md`](aviso-de-consentimiento.md) | Texto exacto que ve el estudiante, cómo elige y cómo retira el consentimiento |
| [`tratamiento-de-datos.md`](tratamiento-de-datos.md) | Qué datos se tratan, para qué, quién los ve, con qué proveedores, cuánto tiempo y cómo se ejercen los derechos |
| [`convenio-anexo-datos.md`](convenio-anexo-datos.md) | Puntos que el convenio con la universidad debería cubrir sobre datos |

## Preguntas que necesitan respuesta del abogado

1. **Quién es el responsable de la base.** ¿La universidad es responsable y Educai encargado del tratamiento, o son corresponsables? De eso depende quién inscribe la base ante la Agencia de Acceso a la Información Pública y quién firma qué con los proveedores.
2. **Transferencia internacional.** Las conversaciones se procesan con la API de Anthropic y la app corre en un proveedor de hosting, ambos con servidores fuera de Argentina. ¿Alcanza con el consentimiento del estudiante o hacen falta cláusulas contractuales con cada proveedor (art. 12)?
3. **Plazos de conservación.** Hoy la app no borra nada por su cuenta (salvo sesiones e intentos de login). Hay una propuesta en `tratamiento-de-datos.md` para que la validen.
4. **Plazo de respuesta a los pedidos.** El estudiante ya descarga una copia de sus datos, borra conversaciones o su cuenta entera y retira el consentimiento desde la app. ¿Hace falta además un canal (correo) para pedidos que no resuelva la app, y con qué plazo?
5. **Estudiantes menores de 18.** El piloto es universitario, pero puede haber estudiantes de 17 años en primer año. ¿Hace falta un consentimiento distinto?
6. **Texto del aviso.** ¿El texto actual alcanza para que el consentimiento sea libre, expreso e informado (art. 5 y 6)? Si hay que cambiarlo, el texto vive en `src/lib/texts.ts` y cada cambio sube la versión del aviso.

Cuando el abogado conteste, cada respuesta que cambie el producto va a `docs/DECISIONES.md` y, si toca el código, a un PR propio.
