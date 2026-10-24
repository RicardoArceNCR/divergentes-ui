# 0003 — Export nativo de Figma en vez del plugin de Jan Toman

Estado: aceptada — octubre 2026

`source/raw/` era el export del plugin Export/Import Variables (Jan Toman):
el volcado de la Plugin API (`id`, `modes`, `variables`). `figma-to-sd.py`
lo convertía a Style Dictionary y, para saber a qué colección apuntaba cada
alias, armaba un mapa de IDs leyendo todos los archivos antes.

Figma exporta las variables por su cuenta, en el formato DTCG 1.0: en
Variables, clic derecho en la colección → **Export modes**. El export trae,
por alias, el nombre de la variable y de la colección destino
(`com.figma.aliasData`) y el valor resuelto. Cuando el alias es dentro de la
misma colección, lo escribe como referencia DTCG (`{brand.main}`) sin valor.

Se cambia la fuente a `source/dtcg/<coleccion>.tokens.json` y la conversión
a `scripts/dtcg-to-sd.mjs`. Las reglas son las de `figma-to-sd.py` sin
cambios: unidades (`px`, `ms`, `em`), `border` → `border-width`,
`spacing.7`, el namespace de `shadow` y `z-index`, los alias de `-dark` que
cruzan a una colección clara se resuelven a literal. Las listas que eran del
cliente (`COLLECTIONS`, `REQUIRED_TOKENS`, los cruces esperados en oscuro)
pasan a `tokens.config.json`, con la forma que propone el kit
`tokens-pipeline` de estudio.

Comprobación: con el export nativo del 2026-10-23, las 636 variables
coinciden una a una con `source/raw` (nombre, valor, alias, descripción);
`source/*.json` sale igual en contenido, y `build/` tiene las mismas
declaraciones en otro orden (el de los grupos de Figma). Faltan las 23
variables de `numbers`, que `figma-to-sd.py` ya no leía.

Consecuencias:

- Sin plugin de terceros. Regenerar los tokens ya no pide Python; `npm run
  sistema` todavía sí.
- Figma nombra el archivo por el modo (`Mode 1.tokens.json`), no por la
  colección: hay que renombrarlo al exportar. Si falta una colección, la
  conversión lo avisa.
- `semanticos-dark` y `componentes-dark` siguen siendo colecciones aparte
  (no modos), como antes.
