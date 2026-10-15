# Reglas de Diseño: Taste Library (Linear Dark-Technical Benchmark)

Todas las interfaces y componentes en Educai siguen los estándares de diseño extraídos de **Linear** (Cosign High Taste Rank #3) documentados en `.agents/skills/taste-library/`:

## 1. Paleta de Colores y Jerarquía Visual
- **Canvas / Fondo Principal**: `#08090A` (Deep Space neutral, sin tintes azules saturados).
- **Superficies y Paneles**: `#0F1011` (Surface 1) y `#121414` (Surface 2 para inputs y tarjetas internas).
- **Superficies Elevadas**: `#18191B` (Surface 3 para popovers y estados activos).
- **Bordes y Elevación**: La elevación se construye exclusivamente mediante bordes blancos translúcidos finos de 1px (`rgba(255, 255, 255, 0.08)` o `border-white/[0.08]`), nunca con sombras pesadas difusas.
- **Jerarquía Tipográfica de Alto Contraste**:
  - Encabezados principales y botones primarios: `#F7F8F8` (Blanco de alto contraste).
  - Texto principal de lectura y descripciones: `#D0D6E0` (Blanco suave apagado que previene la fatiga visual).
  - Metadatos secundarios y etiquetas: `#8A8F98` (Gris frío intermedio).
  - Iconos inactivos y bordes tenues: `#62666D` (Neutro tenue).
- **Acento Primario**: `#5E6AD2` (Índigo técnico Linear) con micro-iluminación superior (`shadow-[inset_0_1px_0_0_rgba(255,255,255,0.2)]`).

## 2. Componentes y Controles
- **Radios de Borde**:
  - Tarjetas y paneles principales: `rounded-2xl` (16px).
  - Controles, botones e inputs: `rounded-xl` (12px) o `rounded-lg` (8px).
  - Badges y píldoras: `rounded-full` con tipografía monoespaciada (`font-mono text-[10px]`).
- **Transiciones**: `transition-all duration-150 ease-out`.
- **Efecto Glass**: `backdrop-blur-xl` con fondos semitransparentes (`bg-[#08090A]/85`).

## 3. Restricciones
- **Estricto ZERO EMOJIS**: Prohibido el uso de emojis en toda la aplicación. Utilizar exclusivamente iconos vectoriales SVG de Lucide React (ej. Check, X, ChevronRight, ArrowRight).
