---
name: Apex Pro Dashboard
description: Panel de gestión operativa para una empresa de detailing automotriz premium en Perú
colors:
  primary: "#dc2626"
  primary-deep: "#b91c1c"
  primary-soft: "#fee2e2"
  ink-night: "#1e1e1e"
  surface-day: "#ffffff"
  surface-night: "#111827"
  bg-day: "#f9fafb"
  bg-night: "#030712"
  border-day: "#f3f4f6"
  border-night: "#1f2937"
  ink: "#111827"
  ink-muted: "#6b7280"
  success: "#16a34a"
  warning: "#d97706"
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "normal"
  title:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "normal"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.primary-deep}"
  button-danger:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  card:
    backgroundColor: "{colors.surface-day}"
    rounded: "{rounded.md}"
    padding: "16px"
---

# Design System: Apex Pro Dashboard

## 1. Overview

**Creative North Star: "El Taller de Precisión"**

Apex Pro es la pantalla de control de un taller de detailing automotriz premium: el mismo cuidado con el que se entrega un auto recién detallado se aplica a cada pantalla. La interfaz no decora, calibra. Cada número, cada estado de ticket, cada fila de nómina está donde debe estar, con el peso visual exacto que merece — ni más, ni menos.

El sistema vive en dos superficies con la misma alma: una **consola de escritorio** oscura y densa para el dueño (sidebar casi negro `#1e1e1e`, datos de nómina y reportes), y una **app de bolsillo** clara y rápida para el trabajador en planta (tarjetas blancas, botones grandes, acción inmediata). El rojo `#dc2626` es la única firma de marca que cruza ambas: aparece poco, pero cuando aparece, es la señal de "esto importa" (acción principal, alerta, estado activo).

Se rechaza explícitamente la plantilla de SaaS genérico: nada de cards idénticas en grilla, nada de eyebrows en mayúsculas sobre cada sección, nada de texto en gradiente. El lujo aquí se gana con espaciado correcto, jerarquía tipográfica limpia y motion intencional — no con adornos decorativos intercambiables con cualquier dashboard.

**Key Characteristics:**
- Acento rojo único y escaso — nunca decorativo, siempre funcional (acción, alerta, estado activo)
- Sidebar casi-negro como ancla de marca en escritorio; superficies claras como ancla de velocidad en móvil
- Profundidad real (sombras marcadas) en cards y modales para reforzar la sensación premium, no solo bordes planos
- Motion ya presente (entradas/salidas en modales y FAB) como parte del lenguaje visual, no un añadido cosmético
- Datos primero: nómina, ingresos y ratios siempre con máxima legibilidad, sin competir con elementos decorativos

## 2. Colors

La paleta es deliberadamente corta: un rojo de marca, un casi-negro de marca, y una escala neutra que hace todo el trabajo de fondo.

### Primary
- **Rojo Apex** (`#dc2626`): acción principal — botones primarios, FAB, estados activos de navegación, totales destacados en nómina. Es el único color que debe notarse; úsalo con moderación deliberada.
- **Rojo Apex Profundo** (`#b91c1c`): estado hover/press del rojo primario. Mismo hue, más oscuro, nunca un color distinto.
- **Rojo Suave** (`#fee2e2`): fondo de acciones destructivas suaves (botón "dar de baja", badges de descuento), nunca como fondo de página.

### Neutral
- **Negro Taller** (`#1e1e1e`): superficie de marca en escritorio — sidebar, fondo del FAB abierto. No es un gris-900 genérico de Tailwind; es el negro propio de Apex.
- **Blanco Superficie** (`#ffffff`) / **Carbón Superficie** (`#111827`): fondo de cards y modales en modo claro/oscuro respectivamente.
- **Niebla** (`#f9fafb`) / **Vacío** (`#030712`): fondo de página en modo claro/oscuro.
- **Línea Día** (`#f3f4f6`) / **Línea Noche** (`#1f2937`): bordes y divisores sutiles.
- **Tinta** (`#111827`): texto principal. **Tinta Apagada** (`#6b7280`): texto secundario/metadatos — nunca por debajo de 4.5:1 de contraste sobre su fondo.

### Estado
- **Verde Confirmado** (`#16a34a`): semáforos e indicadores positivos (ratio alto, ticket cerrado).
- **Ámbar Atención** (`#d97706`): incidencias, advertencias suaves (tardanza, trabajador que se retira a mitad de mes).

### Named Rules
**La Regla del Rojo Escaso.** El rojo primario ocupa menos del 10% de cualquier pantalla. Si una vista tiene más de dos elementos rojos a la vez (fuera de badges de estado), es una señal de que se está usando como decoración, no como acción.

## 3. Typography

**Display/Body Font:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif

**Character:** Una sola familia, el stack nativo del sistema, en distintos pesos y tamaños. No hay segunda fuente decorativa — la jerarquía se construye con peso y tamaño, no con mezcla de tipos. Esto mantiene la app rápida (sin fuentes web que cargar) y consistente entre dispositivos.

### Hierarchy
- **Display** (700, 1.5rem/24px, 1.25): títulos de página ("Equipo", "Nómina", "Panel").
- **Title** (700, 1.125rem/18px, 1.3): títulos de modal y tarjeta de resumen (ej. encabezado del ticket con placa).
- **Body** (400, 0.875rem/14px, 1.5): texto de tablas, formularios, contenido general. Máximo ~70ch en bloques de texto largo.
- **Label** (500, 0.75rem/12px, 1.4): metadatos, badges, texto auxiliar bajo nombres (horas/semana, fecha de baja).

### Named Rules
**La Regla de Una Sola Voz Tipográfica.** Toda la app usa una única familia tipográfica. La diferencia entre un título y una nota al pie es peso y tamaño, nunca una fuente distinta.

## 4. Elevation

El sistema usa **sombras reales como señal de jerarquía**, no capas tonales planas. Las cards y modales se separan del fondo con sombra visible (no solo borde de 1px), reforzando la sensación de objetos físicos cuidadosamente colocados — coherente con un negocio que vende acabado premium.

### Shadow Vocabulary
- **Reposo** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)`): cards en su estado normal dentro del flujo (tabla, lista).
- **Flotante** (`box-shadow: 0 10px 25px -5px rgba(0,0,0,0.15), 0 8px 10px -6px rgba(0,0,0,0.1)`): modales, hojas inferiores, el FAB y su menú — cualquier elemento que se superpone al contenido.
- **Énfasis Rojo** (`box-shadow: 0 8px 20px -4px rgba(220,38,38,0.35)`): reservado para el botón de acción principal (FAB, "Entrar") cuando se quiere que el rojo proyecte su propia luz, no solo pintar un fondo.

### Named Rules
**La Regla de la Sombra con Propósito.** Una sombra marcada se usa cuando el elemento flota sobre el contenido (modal, FAB, dropdown). Un elemento que vive dentro del flujo normal (fila de tabla, card de lista) usa como máximo la sombra de Reposo.

## 5. Components

### Buttons
- **Shape:** esquinas suavemente curvas (8px, `rounded-lg`).
- **Primary:** fondo Rojo Apex (`#dc2626`), texto blanco, padding `8px 16px`, peso medio. Hover → Rojo Apex Profundo (`#b91c1c`). Press → `scale(0.97)`.
- **Secondary:** fondo gris neutro (`bg-gray-100` / `dark:bg-gray-800`), texto `ink-muted`. Mismo radio y padding que primary.
- **Danger:** fondo Rojo Suave (`#fee2e2`), texto Rojo Apex. Reservado para acciones destructivas de baja fricción (no para "eliminar" definitivo, que usa confirmación aparte).
- **FAB (signature):** circular 56px, fondo Rojo Apex en reposo, fondo `ink-night` cuando está abierto (mostrando su menú), con Sombra de Énfasis Rojo. Su menú se abre con escala desde `0.95` + opacity, ancladas al propio FAB (`transform-origin: bottom right`).

### Cards / Containers
- **Corner Style:** 12px (`rounded-xl`).
- **Background:** Blanco Superficie / Carbón Superficie según tema.
- **Shadow Strategy:** sombra de Reposo; nunca apiladas (nada de card-dentro-de-card).
- **Border:** 1px Línea Día/Noche, sutil, de apoyo a la sombra — no como único separador.
- **Internal Padding:** 16px (`md`).

### Inputs / Fields
- **Style:** fondo gris muy claro (`bg-gray-50` / `dark:bg-gray-800`), borde 1px Línea Día/Noche, radio 8px.
- **Focus:** anillo rojo de 2px (`focus:ring-2 focus:ring-red-600`), borde transparente — el rojo aparece exactamente cuando el usuario está interactuando, reforzando la Regla del Rojo Escaso.
- **Disabled:** opacidad reducida, cursor not-allowed.

### Navigation
- **Sidebar (escritorio):** fondo `ink-night` (`#1e1e1e`), ítem activo con fondo rojo translúcido y borde/texto rojo; resto del texto en gris claro sobre el negro.
- **Tab bar (móvil):** iconos + labels en la parte inferior, ítem activo en Rojo Apex, resto en gris.
- **Modals / Bottom sheets:** entran con fade + scale (modal centrado) o slide-up (hoja inferior), salida más rápida que la entrada (~160ms vs ~200-250ms de entrada), siguiendo el principio de "lento al decidir, rápido al responder".

### Badges
- **Style:** pastilla completamente redonda (`rounded-full`), fondo tenue del color de estado (10-20% opacidad), texto en la versión saturada del mismo color. Variantes: verde (confirmado), ámbar (atención), rojo (descuento/incidencia), gris (neutro).

## 6. Do's and Don'ts

### Do:
- **Do** usar el Rojo Apex (`#dc2626`) solo para la acción principal de cada pantalla — nunca más de un botón rojo "destacado" visible a la vez fuera de badges de estado.
- **Do** dar sombra real (Flotante) a todo lo que se superpone al contenido: modales, FAB, dropdowns.
- **Do** mantener una sola familia tipográfica; construir jerarquía con peso y tamaño.
- **Do** prorratear y comunicar visualmente los casos especiales de negocio (ej. "Se retiró el DD/MM/AAAA" en ámbar) en vez de ocultarlos.
- **Do** mantener las animaciones de entrada/salida bajo 300ms y con salida más rápida que la entrada.
- **Do** respetar `prefers-reduced-motion` en toda animación nueva.

### Don't:
- **Don't** usar `border-left`/`border-right` de color como acento decorativo en cards o listas.
- **Don't** usar texto en gradiente (`background-clip: text`) para énfasis — usar peso o el Rojo Apex sólido.
- **Don't** repetir el mismo card con icono+título+texto en grilla infinita; si varias filas necesitan lo mismo, es una tabla, no una grilla de cards.
- **Don't** poner un eyebrow en mayúsculas con tracking ancho sobre cada sección — no es el lenguaje visual de esta app.
- **Don't** introducir una segunda familia tipográfica decorativa.
- **Don't** dejar un dashboard que "podría ser cualquier SaaS" — cualquier pantalla nueva debe sentirse de un taller de detailing premium, no intercambiable con otro rubro.
