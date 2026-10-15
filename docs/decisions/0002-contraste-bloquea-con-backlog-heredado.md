# 0002 — El contraste bloquea el build, con el backlog heredado a la vista

Estado: aceptada — octubre 2026

misitio-ui no medía contraste. Al armar `scripts/contrast-pairs.json` con
los pares reales de Divergentes (texto sobre fondo, botones, on-brand,
feedback), 23 de 66 mediciones fallan AA. Los más visibles: el teal de
`brand/action` con texto blanco encima (2.35:1), los enlaces en
`info/500` sobre la página (2.25:1) y `text/tertiary` en los dos temas.

Arreglarlos cambia colores, y la v0.1.0 existe para no cambiar ninguno
(ADR 0001). Tampoco sirve un chequeo apagado: el próximo cambio en Figma
podría romper un par que hoy pasa sin que nadie lo vea.

`check-contrast.mjs` corre en `npm test` y en CI como en hablemos-ui. Los
23 pares van a `ALLOW` con el motivo "heredado de misitio-ui v0.1.6,
revisar en Figma" y el ratio medido. Cualquier par nuevo que falle rompe el
build. Cada línea se borra cuando el arreglo llega desde Figma; el mismo
criterio vale para las tres entradas de `check-ramps`.
