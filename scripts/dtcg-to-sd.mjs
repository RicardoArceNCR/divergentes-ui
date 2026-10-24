#!/usr/bin/env node
// dtcg-to-sd.mjs — export nativo de Figma (DTCG) → fuentes de Style Dictionary v4.
//
// Lee:     source/dtcg/<coleccion>.tokens.json   (Figma → Variables → clic
//          derecho en la colección → Export modes; un archivo por colección,
//          renombrado al nombre de la colección)
// Escribe: source/<coleccion>.json
// Config:  tokens.config.json → figma.collections, figma.required,
//          figma.darkCrossCollection
//
// Reemplaza a figma-to-sd.py, que leía el export del plugin de Jan Toman
// (formato de la Plugin API). Las reglas son las mismas; lo que cambió es la
// lectura: el export nativo trae el nombre de la colección destino de cada
// alias (com.figma.aliasData), así que ya no hace falta un mapa de IDs.
//
// source/dtcg/ es la fuente de verdad (ADR 0008 de estudio): un archivo DTCG
// escrito a mano o por otra herramienta también sirve. Un alias sin
// com.figma.aliasData ({a.b}) se busca primero en su colección y después en
// las demás; si está en más de una, es un error y hay que desambiguarlo
// desde Figma.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IN_DIR = process.env.DTCG_IN ?? join(ROOT, 'source', 'dtcg');
const OUT_DIR = process.env.SD_OUT ?? join(ROOT, 'source');
const config = JSON.parse(readFileSync(join(ROOT, 'tokens.config.json'), 'utf8')).figma;

const COLLECTIONS = config.collections;
const REQUIRED = config.required ?? {};
const EXPECTED_DARK_CROSS = new Set(config.darkCrossCollection ?? []);

// shadow y z-index llegan de Figma sin el prefijo de colección en el nombre
// ('sm', 'modal'); se envuelven bajo la colección y se namespacean los alias.
const FLAT_COLLECTIONS = new Set(['shadow', 'z-index']);

// Si Figma vuelve a exportar motion como strings no-CSS.
const MOTION_MAP = { 'motion/fast': '150ms ease', 'motion/normal': '250ms ease', 'motion/slow': '400ms ease' };

const TYPE_MAP = { number: 'float', string: 'string', boolean: 'boolean', color: 'color' };

// El build oscuro carga -dark + primitivos + shadow; un alias desde -dark a
// otra colección se resuelve a literal para que el build sea autocontenido.
const inDarkBuild = (col) => col === 'primitivos' || col === 'shadow' || col.endsWith('-dark');

let failed = false;
const fail = (msg) => { console.log(`✗ ${msg}`); failed = true; };

// ─── Valores ────────────────────────────────────────────────────────────────

// Redondeo half-even, igual que round() de Python.
function roundHalfEven(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function colorToken({ components: [r, g, b], alpha = 1 }) {
  const [R, G, B] = [r, g, b].map((c) => roundHalfEven(c * 255));
  if (alpha >= 1) {
    const hex = [R, G, B].map((c) => c.toString(16).padStart(2, '0')).join('');
    return { $type: 'color', $value: `#${hex}` };
  }
  const a = alpha.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  // alpha < 1 va como string para que Style Dictionary no pierda precisión.
  return { $type: 'string', $value: `rgba(${R}, ${G}, ${B}, ${a})` };
}

function literalToken(value, type) {
  if (type === 'color') return colorToken(value);
  if (type === 'number') {
    // Ruido de float de Figma: 0.4000000059604645 → 0.4
    const clean = Number.isInteger(value) ? value : Number(value.toFixed(4));
    return { $type: 'float', $value: clean };
  }
  const s = String(value);
  return { $type: 'string', $value: MOTION_MAP[s] ?? s };
}

// ─── Lectura del export nativo ──────────────────────────────────────────────

function* walk(node, path = []) {
  if (node && typeof node === 'object') {
    if ('$value' in node) { yield [path, node]; return; }
    for (const [k, v] of Object.entries(node)) if (!k.startsWith('$')) yield* walk(v, [...path, k]);
  }
}

const isRef = (v) => typeof v === 'string' && /^\{[^{}]+\}$/.test(v);

// Índice de todas las colecciones: nombre → (ruta con puntos → [ruta, token]).
const INDEX = new Map();

function indexCollection(name, data) {
  const byRef = new Map();
  for (const [path, tok] of walk(data)) byRef.set(path.join('.'), [path, tok]);
  INDEX.set(name, byRef);
}

// Dónde vive el destino de {a.b}, en el mismo orden en que arman los builds:
// 1. su propia colección;
// 2. desde una -dark, las otras -dark;
// 3. las colecciones claras. Una clara nunca apunta a una -dark: el build
//    claro no las carga.
// Si en un paso aparece en más de una colección, es ambiguo.
function locate(fromCollection, key) {
  const dark = (c) => c.endsWith('-dark');
  const others = [...INDEX.keys()].filter((c) => c !== fromCollection);
  const tiers = [[fromCollection]];
  if (dark(fromCollection)) tiers.push(others.filter(dark));
  tiers.push(others.filter((c) => !dark(c)));
  for (const tier of tiers) {
    const found = tier.filter((c) => INDEX.get(c)?.has(key));
    if (found.length === 1) return found[0];
    if (found.length > 1) throw new Error(`{${key}} es ambiguo: existe en ${found.join(', ')}. Hacé el alias en Figma y exportá de nuevo.`);
  }
  throw new Error(`alias sin destino: {${key}}`);
}

// Valor final de un token: sigue los alias {a.b} hasta un literal o hasta un
// alias de Figma a otra colección (que trae el valor resuelto).
function resolve(collection, tok, seen = new Set()) {
  if (!isRef(tok.$value) || tok.$extensions?.['com.figma.aliasData']) return tok.$value;
  const key = tok.$value.slice(1, -1);
  const target = locate(collection, key);
  if (seen.has(`${target}:${key}`)) throw new Error(`alias circular: {${key}}`);
  seen.add(`${target}:${key}`);
  return resolve(target, INDEX.get(target).get(key)[1], seen);
}

function parseCollection(name, data) {
  const isDark = name.endsWith('-dark');

  const result = {};
  for (const [path, tok] of walk(data)) {
    const varName = path.join('/');
    const type = tok.$type;
    const aliasData = tok.$extensions?.['com.figma.aliasData'];
    let alias = null;
    if (aliasData) alias = { name: aliasData.targetVariableName, collection: aliasData.targetVariableSetName };
    else if (isRef(tok.$value)) {
      const key = tok.$value.slice(1, -1);
      const collection = locate(name, key);
      alias = { name: INDEX.get(collection).get(key)[0].join('/'), collection };
    }

    let token;
    if (alias) {
      if (!alias.name) throw new Error(`alias sin destino en ${name}: ${varName} → ${tok.$value}`);
      const resolved = resolve(name, tok);
      if (isDark && !inDarkBuild(alias.collection)) {
        if (!EXPECTED_DARK_CROSS.has(varName)) {
          console.log(`⚠  ${name}: "${varName}" → alias cruza a "${alias.collection}" ("${alias.name}"). ` +
            'Se resuelve a literal. Verificar si debía apuntar a la variable homónima en la colección -dark.');
        }
        token = literalToken(resolved, type);
      } else {
        let ref = alias.name;
        if (FLAT_COLLECTIONS.has(alias.collection) && !ref.startsWith(alias.collection + '/')) ref = `${alias.collection}/${ref}`;
        let sdType = TYPE_MAP[type] ?? 'string';
        if (type === 'color') sdType = (resolved.alpha ?? 1) >= 1 ? 'color' : 'string';
        token = { $type: sdType, $value: `{${ref.replaceAll('/', '.')}}` };
      }
    } else {
      token = literalToken(tok.$value, type);
    }

    if (varName !== varName.toLowerCase()) {
      console.log(`⚠  Nombre de variable con mayúsculas: "${varName}" → pedir a diseño que lo renombre en lowercase en Figma.`);
    }
    setNested(result, path, token);
  }
  return result;
}

function setNested(obj, path, value) {
  let d = obj;
  for (const k of path.slice(0, -1)) {
    if (!d[k] || typeof d[k] !== 'object') d[k] = {};
    d = d[k];
  }
  const last = path.at(-1);
  if (d[last] && typeof d[last] === 'object' && !('$value' in d[last])) Object.assign(d[last], value);
  else d[last] = value;
}

const countTokens = (n) => (n && typeof n === 'object' ? ('$value' in n ? 1 : Object.values(n).reduce((s, v) => s + countTokens(v), 0)) : 0);

// ─── Transformaciones por colección ─────────────────────────────────────────

const TRANSFORMS = {
  primitivos(t) {
    // border → border-width: evita chocar con 'border' (colores) de semanticos.
    if ('border' in t && !('border-width' in t)) { t['border-width'] = t.border; delete t.border; }
    // spacing.7 = 28 falta en Figma (entre 6 = 24 y 8 = 32).
    if (t.spacing && !('7' in t.spacing)) t.spacing['7'] = { $type: 'float', $value: 28 };
    return t;
  },
  shadow: (t) => ({ shadow: t }),
  'z-index': (t) => ({ 'z-index': t }),
};

// ─── Unidades ───────────────────────────────────────────────────────────────

function needsPx(p) {
  const n = p.length;
  if (n < 2) return false;
  if (['spacing', 'radius', 'border-width'].includes(p[0])) return true;
  if (n >= 3 && p[0] === 'typography' && p[1] === 'size') return true;
  if (n >= 4 && p[0] === 'typography' && p[1] === 'styles' && ['size', 'line-height', 'letter-spacing'].includes(p.at(-1))) return true;
  if (n >= 3 && p[0] === 'button' && p[1] === 'text-size') return true;
  if (p[0] === 'button' && p[1] === 'radius') return true;
  if (n >= 4 && p[0] === 'button' && p[1] === 'size' && ['padding-x', 'padding-y', 'height'].includes(p[3])) return true;
  if (p[0] === 'card' && ['padding', 'radius'].includes(p[1])) return true;
  if (p[0] === 'input' && ['radius', 'padding-x', 'padding-y'].includes(p[1])) return true;
  if (n >= 3 && p[0] === 'pill' && ['padding-x', 'padding-y'].includes(p[2])) return true;
  if (n >= 3 && p[0] === 'layout' && ['padding-x', 'padding-y', 'gap-x'].includes(p[2])) return true;
  if (n >= 3 && p[0] === 'pill' && p[1] === 'text' && ['size', 'line-height', 'letter-spacing'].includes(p[2])) return true;
  if (p[0] === 'pill' && p[1] === 'sm') return true;
  if (n >= 3 && p[0] === 'pill' && p[2] === 'border-width') return true;
  if (n >= 4 && p[0] === 'button' && p[1] === 'base' && p[2] === 'border' && p[3] === 'width') return true;
  if (p[0] === 'focus' && ['ring-width', 'offset', 'outline-offset'].includes(p[1])) return true;
  if (n >= 3 && p[0] === 'focus' && p[1] === 'ring' && ['focus-ring-offset', 'focus-ring-width'].includes(p[2])) return true;
  if (n >= 3 && p[0] === 'button' && p[1] === 'base' && ['radius', 'gap'].includes(p[2])) return true;
  if (n >= 3 && p[0] === 'pill' && p[1] === 'base' && ['radius', 'font-size'].includes(p[2])) return true;
  // En la colección oscura estos son valores concretos sin alias (en la clara
  // heredan la unidad del primitivo). Falta el alias del lado de Figma.
  if (p[0] === 'nav' && p[1] === 'height') return true;
  if (['modal', 'pill', 'toast', 'tooltip'].includes(p[0]) && p[1] === 'radius') return true;
  if (n >= 3 && p[0] === 'avatar' && p[1] === 'size') return true;
  return false;
}

// motion/duration/* llega en ms; typography/tracking/* es un ratio → em.
const needsMs = (p, col) => col === 'motion' && p.length >= 2 && p.at(-2) === 'duration';
const needsEm = (p) => p.length >= 2 && p[0] === 'typography' && p[1] === 'tracking';

// Formato 'g' de Python: 6 cifras significativas, sin ceros de más.
function fmtG(v) {
  const s = String(Number(v.toPrecision(6)));
  if (/e/.test(s)) throw new Error(`valor fuera de rango para una unidad: ${v}`);
  return s;
}

function applyUnits(node, col, path = []) {
  if (!node || typeof node !== 'object') return node;
  if ('$value' in node) {
    if (node.$type !== 'float') return node;
    let unit = null;
    if (needsPx(path) || (col === 'breakpoints' && path.length === 1)) unit = 'px';
    else if (needsMs(path, col)) unit = 'ms';
    else if (needsEm(path)) unit = 'em';
    if (unit) {
      const v = node.$value;
      if (typeof v === 'number') return { $type: 'dimension', $value: `${fmtG(v)}${unit}` };
      if (isRef(v)) return { $type: 'dimension', $value: v };
    }
    return node;
  }
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, applyUnits(v, col, [...path, k])]));
}

function validate(name, tokens) {
  for (const path of REQUIRED[name] ?? []) {
    let n = tokens;
    for (const k of path) n = n && typeof n === 'object' ? n[k] : undefined;
    if (!n || typeof n !== 'object' || !('$value' in n)) fail(`Token faltante: ${name} → ${path.join('/')}`);
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log('Figma (export nativo DTCG) → Style Dictionary\n');
if (!existsSync(IN_DIR)) {
  console.log(`✗ No existe ${IN_DIR}. Exportá las colecciones desde Figma a esa carpeta.`);
  process.exit(1);
}

const missing = COLLECTIONS.filter((c) => !existsSync(join(IN_DIR, `${c}.tokens.json`)));
if (missing.length === COLLECTIONS.length) {
  console.log(`✗ No hay archivos en source/dtcg/. Esperados: ${COLLECTIONS.map((c) => `${c}.tokens.json`).join(', ')}`);
  process.exit(1);
}
if (missing.length) console.log(`⚠  Colecciones sin archivo (se omiten): ${missing.join(', ')}\n`);

const data = {};
for (const name of COLLECTIONS) {
  if (missing.includes(name)) continue;
  data[name] = JSON.parse(readFileSync(join(IN_DIR, `${name}.tokens.json`), 'utf8'));
  indexCollection(name, data[name]);
}

let total = 0;
for (const name of COLLECTIONS) {
  if (missing.includes(name)) continue;
  let tokens;
  try {
    tokens = parseCollection(name, data[name]);
  } catch (e) {
    console.log(`✗ Error en ${name}.tokens.json: ${e.message}`);
    process.exit(1);
  }
  if (TRANSFORMS[name]) tokens = TRANSFORMS[name](tokens);
  tokens = applyUnits(tokens, name);
  validate(name, tokens);
  const n = countTokens(tokens);
  total += n;
  writeFileSync(join(OUT_DIR, `${name}.json`), JSON.stringify(tokens, null, 2) + '\n');
  console.log(`✓ ${name}.tokens.json → source/${name}.json (${n} tokens)`);
}

if (failed) process.exit(1);
console.log(`\n✓ Total: ${total} tokens`);
