# Changelog

Cada tag dice qué cambió en la paleta y qué tiene que revisar el sitio.
Formato: [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).
Versiones: semver. Un token renombrado o borrado es **mayor**; un valor
nuevo o un token nuevo es **menor**; una descripción o un ajuste que no
cambia el CSS es **parche**.

## [Sin publicar]

### Cambiado

- La fuente pasa a ser el export nativo de Figma (`source/dtcg/`, DTCG) y la conversión a `scripts/dtcg-to-sd.mjs`, que reemplaza a `figma-to-sd.py` y al plugin de Jan Toman (ADR 0003). Los tokens y sus valores no cambian: `build/` tiene las mismas declaraciones, en otro orden. No hace falta versión nueva.

## [0.2.0] — 2026-10-17

### Cambiado

- `brand/font-display` pasa de `Anton` a `League Gothic`, la fuente que el sitio carga desde 2026-08-09 (ADR 0010 de divergentes-web). El sitio no lee este token para pintar: usa la variable de `next/font` (`--typography-family-display`), así que no cambia nada visual. Ojo: el cliente todavía no validó League Gothic; si elige otra, es el mismo cambio con otro valor.

### Eliminado

- `typography/heading/family` (Hanley Pro Block) y `typography/body/family` (Montserrat), en claro y oscuro. Eran restos de la paleta anterior y ningún componente del paquete ni el sitio los usaba. Por eso la versión es menor y no parche: un token borrado es incompatible.

### Para el sitio

- Subir la dependencia a `#v0.2.0`. Revisar que nada lea `--typography-heading-family` ni `--typography-body-family` (en divergentes-web no hay usos).

## [0.1.0] — 2026-10

Primera versión de `@divergentes/ui`, sucesor de `@misitio/ui` (ADR 0001).

### Paridad

- `build/` es idéntico byte a byte al de `misitio-ui@v0.1.6` (`diff -r` vacío, los cinco archivos, cabeceras incluidas). Ningún token cambia de nombre ni de valor.
- Mismo pipeline que el tag `v0.1.6`: `figma-to-sd.py`, configs de Style Dictionary (4.4.0), `format-tailwind-typography.js`, `theme-bridge.template.css` y `source/`.
- Para el sitio la migración es cambiar la dependencia y el prefijo `@misitio/ui/` por `@divergentes/ui/`.

### Paquete

- `exports` iguales a los de `@misitio/ui`, sin script `prepare` ni `watch` (pnpm lo resuelve por tarball).
- Se quedan en `misitio-ui`: `figma-sync/` (sync de DOM a Figma) y `docs/fix-primitivos-color.md`. No forman parte de la salida.

### Controles

- `check-units` y `check-ramps` de hablemos-ui (mismas reglas que misitio-ui). `check-ramps` mantiene las tres excepciones heredadas: `amarillo` (monotonía y matiz, es un empalme de `leaf` y `gold`) e `info` (croma de 50 a 100).
- `check-contrast.mjs` nuevo: 33 pares en claro y oscuro (66 mediciones). 23 fallan AA y van a `ALLOW` como heredados de misitio-ui v0.1.6, a revisar en Figma (ADR 0002).
- CI (`.github/workflows/verify.yml`): verify, `build/` al día y tag igual a la versión.
- `sistema/sistema.html`, generado por `herramientas/sistema.py` desde `build/`.
