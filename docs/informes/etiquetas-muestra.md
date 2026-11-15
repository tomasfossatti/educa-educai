# Muestra de etiquetas para revisar (etapa 4)

Antes de medir la precisión con el modelo real, el prompt de la etapa 4 pide que Tomás revise 10 de las 30 etiquetas. Son conversaciones sintéticas. Para cada una: ¿las dudas esperadas son las correctas? Si alguna está mal, anotá la corrección al lado y la ajusto en `tests/fixtures/dudas/conversaciones.json`.

La muestra mezcla conversaciones con una duda, con dos dudas y sin dudas.

## c01

- **Estudiante:** No entiendo qué hace que una hipótesis sea falsable. ¿No alcanza con que sea una buena idea?
- **Tutor:** Pensá: ¿qué resultado te diría que tu idea estaba equivocada?
- **Estudiante:** Ni idea, para mí si la idea es buena no puede estar equivocada. Sigo sin ver la diferencia entre hipótesis y opinión.

**Dudas esperadas:** Hipótesis falsables

¿Correcto? ☐ Sí ☐ No → 

## c03

- **Estudiante:** Una hipótesis falsable dice qué resultado la refutaría: por ejemplo, si menos de 20 de 200 oficinistas se suscriben en dos semanas, la descarto.
- **Tutor:** ¿Y qué métrica usarías?
- **Estudiante:** La tasa de conversión a suscripción paga en dos semanas, con umbral del 10% y plazo de 14 días.

**Dudas esperadas:** ninguna

¿Correcto? ☐ Sí ☐ No → 

## c05

- **Estudiante:** Mi problema es que no existe una app de viandas saludables en mi barrio.
- **Tutor:** ¿Eso describe un problema del cliente o una solución que falta?
- **Estudiante:** Es el problema, porque no está la app. No me queda claro cuál sería la diferencia.

**Dudas esperadas:** Problema vs. solución

¿Correcto? ☐ Sí ☐ No → 

## c08

- **Estudiante:** Mi hipótesis es que a la gente le van a gustar las viandas. ¿Está bien?
- **Tutor:** ¿Cómo sabrías si es falsa?
- **Estudiante:** No sé cómo probarlo. Tampoco entiendo qué número tendría que medir ni cuánto tendría que dar.

**Dudas esperadas:** Hipótesis falsables, Métricas de validación

¿Correcto? ☐ Sí ☐ No → 

## c12

- **Estudiante:** ¿Cuántas encuestas necesito para validar? Hice 10 y todos dijeron que sí comprarían.
- **Tutor:** ¿Decir que comprarían es lo mismo que comprar?
- **Estudiante:** No veo la diferencia. Si dicen que sí, la métrica da bien, ¿no?

**Dudas esperadas:** Métricas de validación

¿Correcto? ☐ Sí ☐ No → 

## c15

- **Estudiante:** Mi problema es que falta una app y mi propuesta de valor es la app.
- **Tutor:** ¿Qué le pasa hoy al cliente sin la app?
- **Estudiante:** No sé, que no tiene la app. Me confunde separar el problema, la solución y lo que ofrezco.

**Dudas esperadas:** Problema vs. solución, Propuesta de valor

¿Correcto? ☐ Sí ☐ No → 

## c16

- **Estudiante:** Hola, ¿me ayudás a ordenar el cronograma del trabajo práctico?
- **Tutor:** Claro, ¿qué entregas tenés?
- **Estudiante:** El jueves la entrega de segmentación y el lunes la de métricas; quiero repartir el tiempo.

**Dudas esperadas:** ninguna

¿Correcto? ☐ Sí ☐ No → 

## c19

- **Estudiante:** No entiendo qué es un umbral en una métrica.
- **Tutor:** Es el valor a partir del cual decidís seguir o no.
- **Estudiante:** ¿Y cómo sé qué valor poner? Me parece arbitrario y no entiendo para qué sirve.

**Dudas esperadas:** Métricas de validación

¿Correcto? ☐ Sí ☐ No → 

## c22

- **Estudiante:** Mi propuesta de valor es 'calidad y buen precio'. El docente dijo que es genérica y no entiendo por qué.
- **Tutor:** ¿Cualquier competidor podría decir lo mismo?
- **Estudiante:** Sí, pero es lo que ofrezco. No sé cómo hacerla más específica.

**Dudas esperadas:** Propuesta de valor

¿Correcto? ☐ Sí ☐ No → 

## c29

- **Estudiante:** Mi segmento son padres que trabajan y necesitan viandas para sus hijos en edad escolar; los elegí porque el problema aparece todos los días y hoy lo resuelven cocinando de noche.
- **Tutor:** ¿Cómo lo vas a verificar?
- **Estudiante:** Con 15 entrevistas y una prueba de preventa en dos escuelas durante dos semanas.

**Dudas esperadas:** ninguna

¿Correcto? ☐ Sí ☐ No → 
