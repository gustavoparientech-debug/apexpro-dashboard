# Product

## Register

product

## Users

Dos perfiles distintos usan esta app a diario, con contextos físicos opuestos:

- **Admin/dueño** — revisa nómina, reportes y equipo desde un escritorio o laptop, con calma, tomando decisiones de negocio (quién cobra cuánto, quién se retira, cómo va el mes).
- **Trabajadores en el local** — registran tickets de lavado/detailing desde el celular, de pie, entre un servicio y otro, a veces con prisa. Suben fotos de placa y comprobantes de pago (Yape) en el momento.

La app debe sentirse igual de sólida en ambos extremos: una herramienta de escritorio para análisis, y una herramienta de celular para registro rápido en planta.

## Product Purpose

Apex Pro es el panel de gestión operativa de una empresa de detailing automotivo en Perú (lavado, detailing, servicios extra). Cubre todo el ciclo: registro de tickets por trabajador, cálculo de nómina (incluyendo prorrateo cuando alguien se retira a mitad de mes), incidencias de asistencia, gastos, reportes y exportación a PDF/Excel para compartir con el equipo o clientes por WhatsApp.

Éxito = el dueño puede ver el estado del negocio de un vistazo, y el trabajador puede cerrar un ticket en segundos sin pelear con el celular.

## Brand Personality

Premium / detailing de lujo — la interfaz debe transmitir la misma calidad que el servicio que vende: cuidado visual fino, sin volverse decorativa o lenta de usar. Rojo y negro/oscuro ya son la base de marca existente en el código; mantenerlos como ancla, no reinventar la paleta desde cero.

Tono: confiable, preciso, sin relleno. Una herramienta de trabajo que se ve cara, no una app de consumo casual.

## Anti-references

Ninguna específica señalada por el usuario, pero por defecto del registro "product": evitar la plantilla SaaS genérica (cards idénticas, eyebrows en mayúsculas, gradientes decorativos) — el cuidado premium debe notarse en la ejecución (espaciado, tipografía, motion), no en adornos gen��ricos de dashboard.

## Design Principles

1. **Dos modos de uso, un solo sistema** — los flujos de escritorio (nómina, reportes) y los de celular (registro de tickets) comparten tokens y componentes, pero cada uno se optimiza para su contexto físico (mouse + pantalla grande vs. dedo + prisa).
2. **Premium se siente en el detalle, no en el adorno** — la calidad se demuestra con espaciado correcto, tipografía cuidada y motion intencional (ya iniciado con las animaciones de modales/FAB), no con gradientes ni efectos decorativos.
3. **Rápido es parte del diseño** — cada pantalla de registro debe minimizar toques y tiempo de carga; la app ya tuvo problemas reales de performance (fotos pesadas, queries lentas), así que cualquier decisión visual nueva debe respetar ese presupuesto de velocidad.
4. **Los números mandan** — nómina, ingresos, descuentos y ratios son el corazón del producto; deben leerse con jerarquía clara y máxima legibilidad, sin competir con elementos decorativos.
5. **Coherencia con el dominio** — paleta y tono deben evocar detailing automotriz premium (rojo/negro existentes), no un dashboard SaaS genérico intercambiable con cualquier otro rubro.

## Accessibility & Inclusion

Sin requisitos específicos más allá del estándar: cumplir contraste WCAG AA (texto normal ≥4.5:1, texto grande ≥3:1) y soportar `prefers-reduced-motion` en las animaciones ya existentes y futuras.
