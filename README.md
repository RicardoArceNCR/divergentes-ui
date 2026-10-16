# @divergentes/ui

Tokens de Divergentes. La fuente que se edita es el Figma maestro de Divergentes, el mismo que alimentaba `@misitio/ui`. `source/raw/` es el export (plugin Export/Import Variables de Jan Toman). El CSS de `build/` se genera y se versiona para que el sitio no corra Python ni Style Dictionary.

```bash
npm run verify                       # figma-to-sd + Style Dictionary + chequeos
npm run sistema                      # regenera sistema/sistema.html
```

Sucede a `@misitio/ui`: la v0.1.0 publica un `build/` idéntico byte a byte al de `misitio-ui@v0.1.6`, así que migrar no cambia nada visual (ADR 0001).

## En el sitio

El sitio de Divergentes (`misitio`) fija un tag, nunca una rama:

```json
"@divergentes/ui": "github:RicardoArceNCR/divergentes-ui#v0.1.0"
```

El repo es **privado**: el sitio necesita un token para instalarlo en Vercel y en CI. En `divergentes-web` es un PAT fine-grained (`divergentes-web-deps-read`, Contents: Read sobre este repo) guardado como `MISITIO_UI_READ_TOKEN` en Vercel (Production y Preview) y en los secrets de Actions; `scripts/git-auth-private-deps.sh` del sitio reescribe las URLs de GitHub a HTTPS con ese token antes de `pnpm install`. Sin el token, el install falla al clonar este repo. En local alcanza con tu SSH.

El paquete no tiene script `prepare`, así que no corre nada al instalarse: llega `build/` tal cual.

Un solo grafo de `@import`, todo dentro de `globals.css`:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@import "@divergentes/ui/tokens.css";       /* :root, claro       */
@import "@divergentes/ui/tokens-dark.css";  /* .dark              */
@import "@divergentes/ui/theme-bridge.css"; /* Tailwind v4 + shadcn */
```

Y `layout.tsx` importa solo `./globals.css`. Si los tokens se importan desde JS y el bridge desde CSS, el bundler emite dos hojas y decide él el orden; con `@import` queda una sola hoja y el orden es el del código. El oscuro va por la clase `.dark`, no por `prefers-color-scheme`.

El sitio no redefine la paleta. Si hace falta un color que no existe, se agrega como semántico en Figma y sale en una versión nueva.

## Qué publica

`exports`: `tokens.css`, `tokens-dark.css`, `theme-bridge.css` y `build/*` (que incluye `theme-bridge-typography.generated.css` y `tokens.js`). `files` deja afuera `source/`, el pipeline y los chequeos: al sitio le llegan `build/`, este README y `package.json`.

Rampas (`color/<familia>/<stop>`): `neutral`, `main` (teal, acción), `accent` (rojo de marca), `red`, `info` (cielo, enlaces), `leaf` (éxito), `gold`, `amarillo` e `ink`. Tipografía: Anton (display), Red Hat Display (texto), Newsreader (editorial) e IBM Plex Mono, en `brand/font-*`.

## Controles

`npm test`, dentro de `verify`:

- `check-units`: ningún token sale con un número pelado ni queda pelado en oscuro.
- `check-ramps`: monotonía, matiz, croma y `neutral` acromático.
- `check-contrast`: los pares de `scripts/contrast-pairs.json`, WCAG 2 en claro y oscuro.

Cada chequeo tiene una lista `ALLOW`, la única vía para que algo en falla pase, con motivo escrito. Hoy tiene 3 entradas en rampas y 23 en contraste, todas heredadas de `misitio-ui@v0.1.6`: son el backlog para Figma, no permisos (ADR 0002).

CI (`.github/workflows/verify.yml`): `npm run verify`, `build/` y `source/*.json` al día con `source/raw`, y tag igual a la versión. Decisiones en `docs/decisions/`, cambios por versión en `CHANGELOG.md`.

## Publicar una versión

1. Exportá desde Figma las colecciones que cambiaron a `source/raw/`.
2. `npm run verify` y `npm run sistema`.
3. Anotá el cambio en `CHANGELOG.md` y subí `version` en `package.json`.
4. Commit, `git tag vX.Y.Z`, push con tags. CI valida que el tag coincida.
5. En el sitio, subí el pin de `@divergentes/ui` a ese tag.
