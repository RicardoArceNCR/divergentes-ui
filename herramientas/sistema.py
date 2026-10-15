#!/usr/bin/env python3
"""
sistema.py — genera la pagina de design system de Divergentes a partir del CSS
compilado (build/). Adaptado de hablemos-ui.

  python3 herramientas/sistema.py        (desde la raiz del paquete)

Escribe sistema/sistema.html. La pagina no define colores propios: todo sale de
build/tokens.css y build/tokens-dark.css, incrustados tal cual. Si cambia Figma,
se reexporta, se corre npm run verify y se vuelve a generar esta pagina.

Los hex de marca tampoco estan escritos aca: se leen del CSS. Lo unico propio de
Divergentes es que familia cumple que rol y los textos de muestra.
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, 'herramientas'))
from color import wcag, apca  # noqa: E402

# Orden y rotulo de las rampas tal como salen de Figma (color/<familia>/<stop>).
FAMILIES = ['neutral', 'main', 'accent', 'red', 'info', 'leaf', 'gold', 'amarillo', 'ink']
FAM_LABEL = {
    'neutral': 'neutral · grises acromáticos',
    'main': 'main · teal de marca, acción',
    'accent': 'accent · rojo de marca, texto de marca y error',
    'red': 'red · mismo hex que accent; lo usa surface/highlight',
    'info': 'info · cielo, enlaces y foco',
    'leaf': 'leaf · verde, éxito',
    'gold': 'gold · amarillo de marca',
    'amarillo': 'amarillo · 400–600 son amarillo; el resto es copia de leaf (ALLOW en check-ramps)',
    'ink': 'ink · azul tinta, superficies oscuras',
}
BRAND = [  # familia/stop, rol en los semanticos
    ('main', 500, 'brand/action, brand/main. Botón primario y acentos de navegación.'),
    ('accent', 500, 'text/brand, feedback/error. El rojo de la marca.'),
    ('gold', 500, 'brand/gold. Destacados.'),
    ('leaf', 500, 'brand/leaf, feedback/success.'),
    ('info', 400, 'brand/sky, focus/ring-color. Enlaces en info/500–700.'),
    ('ink', 500, 'surface/ink. Bandas oscuras con text/on-ink.'),
    ('neutral', 900, 'text/primary en claro, surface/inverse.'),
]
TYPE = [  # clase, muestra, familia
    ('display-hero', 'Divergentes', 'display'),
    ('display-xl', 'Periodismo de investigación', 'display'),
    ('display-lg', 'Lo que no se cuenta desde la capital', 'display'),
    ('display-md', 'Datos, territorio y memoria', 'display'),
    ('display-sm', 'Una historia, muchas fuentes', 'display'),
    ('heading-h1', 'Quién decide sobre el agua del valle', 'body'),
    ('heading-h2', 'Tres años de expedientes cerrados', 'body'),
    ('heading-h3', 'Cómo hicimos esta investigación', 'body'),
    ('heading-h4', 'Metodología y fuentes', 'body'),
    ('heading-h5', 'Notas relacionadas', 'body'),
    ('body-lg', 'Texto de muestra para el cuerpo grande. Un párrafo de entrada tiene que leerse cómodo a esta medida, sin que el interlineado se abra de más.', 'editorial'),
    ('body-md', 'Texto de muestra para el cuerpo de las notas. Todo se compone alineado a la izquierda, con bandera derecha irregular.', 'body'),
    ('body-sm', 'Pie de foto: lugar, mes y año.', 'body'),
    ('body-xs', 'Fuente: elaboración propia con datos públicos.', 'body'),
    ('label-md', 'Suscribite al boletín', 'body'),
    ('overline-lg', 'Investigación', 'body'),
    ('code-md', 'npm run verify', 'mono'),
]

# Misma lista que bloquea el build (scripts/check-contrast.mjs), y su ALLOW.
PAIRS = json.load(open(os.path.join(ROOT, 'scripts', 'contrast-pairs.json'), encoding='utf-8'))['pairs']
_cc = open(os.path.join(ROOT, 'scripts', 'check-contrast.mjs'), encoding='utf-8').read()
ALLOW = {({'claro': 'Claro', 'oscuro': 'Oscuro'}[t], fg, bg)
         for t, fg, bg in re.findall(r'theme:\s*"(\w+)",\s*fg:\s*"([^"]+)",\s*bg:\s*"([^"]+)"', _cc)}


def css_colors(*sheets):
    """Resuelve var() sobre las hojas dadas (la última pisa) y devuelve {token: #HEX} opacos."""
    decl = {}
    for css in sheets:
        decl.update(dict(re.findall(r'--([a-z0-9-]+)\s*:\s*([^;]+);', css)))

    def res(n, d=0):
        v = decl.get(n, '').strip()
        m = re.fullmatch(r'var\(--([a-z0-9-]+)\)', v)
        return res(m.group(1), d + 1) if m and d < 20 else v
    return {n: res(n).upper() for n in decl if re.fullmatch(r'#[0-9a-fA-F]{6}', res(n))}


def css_block(css):
    """Devuelve solo las declaraciones dentro del primer bloque { }."""
    m = re.search(r'\{(.*)\}', css, re.S)
    return m.group(1).strip()


def main():
    light_css = open(os.path.join(ROOT, 'build', 'tokens.css'), encoding='utf-8').read()
    dark_css = open(os.path.join(ROOT, 'build', 'tokens-dark.css'), encoding='utf-8').read()
    light, dark = css_block(light_css), css_block(dark_css)
    version = json.load(open(os.path.join(ROOT, 'package.json'), encoding='utf-8'))['version']

    ramps = {}
    for fam, stop, hx in re.findall(r'--color-([a-z]+)-(\d+):\s*(#[0-9a-fA-F]{6})', light_css):
        ramps.setdefault(fam, {})[int(stop)] = hx.upper()
    sem_l = css_colors(light_css)
    sem_d = css_colors(light_css, dark_css)
    anchors = {(f, s) for f, s, _ in BRAND}

    # ── rampas ──
    rows = []
    for fam in FAMILIES + sorted(set(ramps) - set(FAMILIES)):
        cells = []
        for stop in sorted(ramps.get(fam, {})):
            hx = ramps[fam][stop]
            cells.append(
                '<li class="chip%s" style="--c:var(--color-%s-%d)"><span class="sw"></span>'
                '<span class="stop">%d</span><span class="hex">%s</span></li>' % (
                    ' anchor' if (fam, stop) in anchors else '', fam, stop, stop, hx))
        rows.append('<div class="ramp"><h3>%s</h3><ol>%s</ol></div>' % (html.escape(FAM_LABEL.get(fam, fam)), ''.join(cells)))
    ramps_html = '\n'.join(rows)

    # ── marca ──
    white, ink = '#FFFFFF', ramps['neutral'][900]
    brand_cards = []
    for fam, stop, role in BRAND:
        hx = ramps[fam][stop]
        rw, rk = wcag(white, hx), wcag(ink, hx)
        fg = white if rw >= rk else ink
        brand_cards.append(
            '<article class="brand" style="--bg:var(--color-%s-%d);--fg:%s"><h3>%s/%d</h3><p>%s</p>'
            '<dl><dt>hex</dt><dd>%s</dd><dt>blanco encima</dt><dd>%.2f:1</dd><dt>neutral/900 encima</dt><dd>%.2f:1</dd></dl></article>' % (
                fam, stop, fg, fam, stop, html.escape(role), hx, rw, rk))

    # ── contraste ──
    crow = []
    for theme, sem in (('Claro', sem_l), ('Oscuro', sem_d)):
        for fg, bg, mn, kind in PAIRS:
            if fg not in sem or bg not in sem or mn == 0:
                continue
            r = wcag(sem[fg], sem[bg])
            ok = r >= mn
            allowed = (theme, fg, bg) in ALLOW
            state = ('ok', 'pasa %g' % mn) if ok else (('warn', 'falla · ALLOW') if allowed else ('bad', 'falla'))
            crow.append('<tr><td>%s</td><td><span class="pair sm" style="--bg:%s;--fg:%s">Aa</span></td>'
                        '<td><code>--%s</code></td><td><code>--%s</code></td><td class="num">%.2f</td>'
                        '<td class="num">%.0f</td><td>%s</td><td><span class="state %s">%s</span></td></tr>' % (
                            theme, sem[bg], sem[fg], fg, bg, r, abs(apca(sem[fg], sem[bg])), kind, state[0], state[1]))
    contrast_html = '\n'.join(crow)
    fails = sum('state bad' in r for r in crow)
    warns = sum('state warn' in r for r in crow)

    # ── tipografia ──
    trows = []
    for cls, sample, fam in TYPE:
        base = '--typography-styles-' + cls
        ls = base + '-letter-spacing' if base + '-letter-spacing:' in light_css else None
        style = 'font-size:var(%s-size);line-height:var(%s-line-height);%s' % (base, base, 'letter-spacing:var(%s);' % ls if ls else '')
        size = re.search(re.escape(base) + r'-size:\s*([\d.]+)px', light_css).group(1)
        lh = re.search(re.escape(base) + r'-line-height:\s*([\d.]+)px', light_css).group(1)
        lsv = re.search(re.escape(base) + r'-letter-spacing:\s*(-?[\d.]+)px', light_css)
        meta = '%s / %s%s · %s' % (size, lh, ' · %s' % lsv.group(1) if lsv else '', fam)
        trows.append('<li class="trow"><div class="tmeta"><code>%s</code><span>%s</span></div>'
                     '<p class="t-%s t-%s" style="%s">%s</p></li>' % (cls, meta, fam, cls.split('-')[0], style, html.escape(sample)))
    type_html = '\n'.join(trows)

    space = ''.join('<li><code>%s</code><span class="bar" style="width:var(--spacing-%s)"></span></li>' % (s, s)
                    for s in ['1', '2', '3', '4', '5', '6', '8', '10', '12', '16', '20', '24'])
    radii = ''.join('<li><span class="rbox" style="border-radius:var(--radius-%s)"></span><code>%s</code></li>' % (r, r)
                    for r in ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'])
    n_tokens = len(re.findall(r'^\s*--[a-z0-9-]+\s*:', light_css, re.M))

    tpl = open(os.path.join(ROOT, 'herramientas', 'sistema.template.html'), encoding='utf-8').read()
    out = (tpl.replace('/*TOKENS_LIGHT*/', light)
              .replace('/*TOKENS_DARK*/', dark)
              .replace('<!--VERSION-->', version)
              .replace('<!--N_FAMILIES-->', str(len(ramps)))
              .replace('<!--N_TOKENS-->', str(n_tokens))
              .replace('<!--RAMPS-->', ramps_html)
              .replace('<!--BRAND-->', ''.join(brand_cards))
              .replace('<!--CONTRAST-->', contrast_html)
              .replace('<!--CONTRAST_SUMMARY-->', '%d pares medidos en los dos temas: %d fallan y están en ALLOW (heredados de misitio-ui v0.1.6), %d fallan sin excepción.' % (len(crow), warns, fails))
              .replace('<!--TYPE-->', type_html)
              .replace('<!--SPACE-->', space)
              .replace('<!--RADII-->', radii))
    os.makedirs(os.path.join(ROOT, 'sistema'), exist_ok=True)
    path = os.path.join(ROOT, 'sistema', 'sistema.html')
    open(path, 'w', encoding='utf-8').write(out)
    print('escrito', path, '·', len(out) // 1024, 'KB ·', len(crow), 'pares,', warns, 'en ALLOW,', fails, 'fallas')


if __name__ == '__main__':
    main()
