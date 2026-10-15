# 0001 — Paquete propio de Divergentes, sucesor de `@misitio/ui`

Estado: aceptada — octubre 2026

## Contexto

`@misitio/ui` se presentaba como el design system compartido del estudio.
En la práctica tenía un solo dueño de marca: sus tokens son los de
Divergentes, salen del Figma maestro de Divergentes y los consume el sitio
de Divergentes (`misitio`). El otro consumidor, `vper-media-next`, quedó
fijado en `v0.1.4` y va a tener su propio paquete.

El estudio ya no tiene paquete compartido: cada cliente tiene el suyo en
`~/ui/<cliente>-ui` (`hablemos-ui`, `bluezonehomeservices-ui`), con CI,
chequeos y changelog. Un nombre que dice "compartido" sobre la paleta de un
cliente invita a que otro sitio la pise con overrides, que es lo que un
paquete por cliente evita.

## Decisión

- Divergentes pasa a `@divergentes/ui`, en este repo, con la estructura de
  hablemos-ui: `verify.yml`, `.nvmrc`, `CHANGELOG.md`, `check-contrast`,
  `herramientas/sistema.py` y `docs/decisions/`.
- El pipeline (`figma-to-sd.py`, Style Dictionary, bridge y `source/`) se
  toma tal cual del tag `v0.1.6` de misitio-ui, no del working tree.
- La v0.1.0 publica un `build/` idéntico byte a byte al de
  `misitio-ui@v0.1.6`. Comparado con `diff -r`: sin diferencias, ni
  siquiera en las cabeceras. Así la migración del sitio no mezcla un cambio
  de paquete con un cambio visual: si algo se ve distinto, no es el paquete.
- Los defectos conocidos (rampas `amarillo` e `info`, 23 pares de
  contraste) no se arreglan acá: quedan en `ALLOW` con motivo (ADR 0002).

## Consecuencias

- `misitio-ui` queda archivado. `vper-media-next` sigue en `v0.1.4` hasta
  tener `@vper/ui`; no se toca. Su `package.json` en el tag `v0.1.6` dice
  `0.1.5`: se alinea antes de archivarlo, no afecta a este paquete.
- `figma-sync/` (sync de DOM a Figma) se queda en misitio-ui: no produce
  `build/` y no hace falta para publicar tokens.
- El sitio cambia la dependencia y el prefijo de los imports. Con eso
  conviene pasar al grafo único de `@import` en `globals.css` (README).
