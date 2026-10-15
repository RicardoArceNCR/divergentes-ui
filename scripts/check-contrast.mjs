#!/usr/bin/env node
/**
 * Contraste WCAG 2 de los pares semánticos, sobre el CSS ya compilado.
 * Mismo criterio que check-ramps: se valida la salida, no la fuente. Un
 * hex nuevo en Figma que rompa AA no llega a un tag.
 *
 * Lee build/tokens.css (:root) y build/tokens-dark.css (.dark, que se
 * superpone a :root), resuelve las cadenas var() y mide cada par de
 * scripts/contrast-pairs.json en los dos temas.
 *
 * ALLOW: única vía para que un par en falla pase. Cada entrada con motivo.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { pairs } = JSON.parse(readFileSync(path.join(root, "scripts/contrast-pairs.json"), "utf8"));

// v0.1.0 replica byte a byte la salida de misitio-ui v0.1.6 (ADR 0001): los
// colores no se tocan en esta versión. Estos pares ya fallaban allá; quedan
// acá como backlog visible, no como permiso. Se borra la línea cuando el
// arreglo llega desde Figma. El ratio del comentario es el medido en v0.1.0.
const HEREDADO = "heredado de misitio-ui v0.1.6, revisar en Figma";
const ALLOW = [
  { theme: "claro", fg: "text-tertiary", bg: "background-page", why: HEREDADO }, // 2.62:1, mínimo 4.5
  { theme: "claro", fg: "text-tertiary", bg: "surface-base", why: HEREDADO }, // 2.74:1, mínimo 4.5
  { theme: "claro", fg: "text-brand", bg: "background-page", why: HEREDADO }, // 3.78:1, mínimo 4.5
  { theme: "claro", fg: "interaction-link-default", bg: "background-page", why: HEREDADO }, // 2.25:1, mínimo 4.5
  { theme: "claro", fg: "interaction-link-hover", bg: "background-page", why: HEREDADO }, // 3.19:1, mínimo 4.5
  { theme: "claro", fg: "surface-highlight-text", bg: "surface-highlight-bg", why: HEREDADO }, // 3.78:1, mínimo 4.5
  { theme: "claro", fg: "text-on-brand", bg: "brand-action", why: HEREDADO }, // 2.35:1, mínimo 4.5
  { theme: "claro", fg: "text-on-brand", bg: "brand-action-hover", why: HEREDADO }, // 3.44:1, mínimo 4.5
  { theme: "claro", fg: "button-primary-text", bg: "button-primary-bg-press", why: HEREDADO }, // 3.62:1, mínimo 4.5
  { theme: "claro", fg: "button-danger-text", bg: "button-danger-bg", why: HEREDADO }, // 3.94:1, mínimo 4.5
  { theme: "claro", fg: "brand-strong", bg: "brand-subtle", why: HEREDADO }, // 3.28:1, mínimo 4.5
  { theme: "claro", fg: "focus-ring-color", bg: "background-page", why: HEREDADO }, // 1.84:1, mínimo 3
  { theme: "claro", fg: "brand-action", bg: "background-page", why: HEREDADO }, // 2.25:1, mínimo 3
  { theme: "claro", fg: "border-strong", bg: "surface-base", why: HEREDADO }, // 1.82:1, mínimo 3
  { theme: "oscuro", fg: "text-tertiary", bg: "background-page", why: HEREDADO }, // 2.79:1, mínimo 4.5
  { theme: "oscuro", fg: "text-tertiary", bg: "surface-base", why: HEREDADO }, // 2.55:1, mínimo 4.5
  { theme: "oscuro", fg: "surface-highlight-text", bg: "surface-highlight-bg", why: HEREDADO }, // 3.78:1, mínimo 4.5
  { theme: "oscuro", fg: "text-on-brand", bg: "brand-action", why: HEREDADO }, // 2.35:1, mínimo 4.5
  { theme: "oscuro", fg: "text-on-brand", bg: "brand-action-hover", why: HEREDADO }, // 3.44:1, mínimo 4.5
  { theme: "oscuro", fg: "button-primary-text", bg: "button-primary-bg-press", why: HEREDADO }, // 3.62:1, mínimo 4.5
  { theme: "oscuro", fg: "button-danger-text", bg: "button-danger-bg", why: HEREDADO }, // 3.17:1, mínimo 4.5
  { theme: "oscuro", fg: "brand-strong", bg: "brand-subtle", why: HEREDADO }, // 3.28:1, mínimo 4.5
  { theme: "oscuro", fg: "border-strong", bg: "surface-base", why: HEREDADO }, // 2.55:1, mínimo 3
];

function decls(file) {
  const css = readFileSync(path.join(root, file), "utf8");
  const map = new Map();
  for (const [, name, value] of css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/g)) map.set(name, value.trim());
  return map;
}

const light = decls("build/tokens.css");
const dark = new Map([...light, ...decls("build/tokens-dark.css")]);

function resolve(map, name, depth = 0) {
  const v = map.get(name);
  if (v == null || depth > 20) return null;
  const ref = v.match(/^var\(--([a-z0-9-]+)\)$/);
  return ref ? resolve(map, ref[1], depth + 1) : v;
}

function rgb(value) {
  if (!value) return null;
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1].slice(i, i + 2), 16));
  const m = value.match(/^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)$/);
  if (m && (m[4] === undefined || Number(m[4]) === 1)) return [m[1], m[2], m[3]].map(Number);
  return null; // con alfa: depende del fondo, fuera de alcance
}

const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const errors = [];
let measured = 0;
let allowed = 0;
for (const [theme, map] of [
  ["claro", light],
  ["oscuro", dark],
]) {
  for (const [fg, bg, min, use] of pairs) {
    const a = rgb(resolve(map, fg));
    const b = rgb(resolve(map, bg));
    if (!a || !b) {
      errors.push(`${theme}: --${fg} sobre --${bg}: no se pudo resolver (¿token renombrado?)`);
      continue;
    }
    measured++;
    const r = ratio(a, b);
    if (min > 0 && r < min) {
      if (ALLOW.some((x) => x.theme === theme && x.fg === fg && x.bg === bg)) {
        allowed++;
        continue;
      }
      errors.push(`${theme}: --${fg} sobre --${bg} = ${r.toFixed(2)}:1, mínimo ${min} (${use})`);
    }
  }
}

if (errors.length) {
  console.error(`\ncheck-contrast: ${errors.length} problema(s)\n`);
  for (const e of errors) console.error("  - " + e);
  console.error("\nSe arregla en Figma (stop o alias), no acá. Si es intencional, ALLOW con motivo.\n");
  process.exit(1);
}
console.log(`check-contrast: OK — ${measured} pares en claro y oscuro, ${allowed} en ALLOW`);
