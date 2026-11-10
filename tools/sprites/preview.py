#!/usr/bin/env python3
"""Contact sheet of sprite sheets, tinted the way the game paints them (faction camouflage and
team colour), for comparing looks:

  python3 preview.py out.png [--old <git-ref>] key [key ...]

Shows facings 0, 4, 12, 20 of each key (hull + turret), scaled up 3x on a ground colour.
With --old, a second row shows the same keys as committed at <git-ref>.
"""
import io, json, re, subprocess, sys, os
from PIL import Image, ImageChops

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SPR = os.path.join(ROOT, 'assets', 'sprites')
CAMO, TEAM, GROUND = (216, 195, 154), (60, 120, 220), (124, 132, 96)

def load(path, ref):
    if ref:
        data = subprocess.run(['git', 'show', f'{ref}:assets/sprites/{path}'], cwd=ROOT, capture_output=True).stdout
        return Image.open(io.BytesIO(data)).convert('RGBA') if data else None
    p = os.path.join(SPR, path)
    return Image.open(p).convert('RGBA') if os.path.exists(p) else None

def meta(ref):
    txt = subprocess.run(['git', 'show', f'{ref}:assets/sprites/sprites.js'], cwd=ROOT, capture_output=True, text=True).stdout if ref \
        else open(os.path.join(SPR, 'sprites.js')).read()
    return json.loads(re.sub(r'^[^{]*', '', txt).rstrip().rstrip(';'))

def tinted(key, part, ref, building):
    base = load(f'{key}_{part}.png', ref)
    if base is None: return None
    out = base.copy()
    camo = load(f'{key}_{part}_camo.png', ref)
    if camo:
        layer = Image.new('RGBA', base.size, CAMO + (255,))
        a = camo.split()[3]
        mul = ImageChops.multiply(out.convert('RGB'), layer.convert('RGB'))
        out = Image.composite(Image.merge('RGBA', (*mul.split(), base.split()[3])), out, a)
    mask = load(f'{key}_{part}_mask.png', ref)
    if mask:
        tc = tuple(int(c * 0.85) for c in TEAM) if building else TEAM
        rgb = out.convert('RGB')
        # 'color' blend approximated: keep luminance of the shaded pixel, take hue of the team colour
        lum = rgb.convert('L')
        col = Image.merge('RGB', [lum.point(lambda v, c=c: min(255, int(v * c / 150))) for c in tc])
        blend = Image.blend(rgb, col, 0.85)
        out = Image.composite(Image.merge('RGBA', (*blend.split(), out.split()[3])), out, mask.split()[3])
    return out

def frames(key, ref, facings=tuple(int(f) for f in os.environ.get('FACINGS', '0,4,12,20').split(','))):
    m = meta(ref).get(key)
    if not m: return []
    C = m['cell'] * m['res']
    hull = tinted(key, 'hull', ref, key.startswith('b_'))
    tur = tinted(key, 'turret', ref, False) if m['parts'].get('turret') else None
    out = []
    for f in (facings if m.get('facings', 32) > 1 else (0,)):
        box = ((f % m['cols']) * C, (f // m['cols']) * C, (f % m['cols']) * C + C, (f // m['cols']) * C + C)
        cell = hull.crop(box)
        if tur:
            import math
            off = m.get('turretOffset', 0) * m['res']
            a = f / 32 * math.pi * 2
            dx, dy = round((math.cos(a) - math.sin(a)) * off * 0.7071), round((math.cos(a) + math.sin(a)) * off * 0.7071 * 0.5)
            t = tur.crop(box)
            cell.alpha_composite(t, (dx, dy)) if dx >= 0 and dy >= 0 else cell.paste(t, (dx, dy), t)
        bb = cell.split()[3].getbbox()
        if bb: cell = cell.crop((max(0, bb[0] - 8), max(0, bb[1] - 8), min(cell.width, bb[2] + 8), min(cell.height, bb[3] + 8)))
        out.append(cell)
    return out

def main():
    args = sys.argv[1:]
    out, args = args[0], args[1:]
    old = None
    if args and args[0] == '--old': old, args = args[1], args[2:]
    rows = [[c for k in args for c in frames(k, None)]]
    if old: rows.insert(0, [c for k in args for c in frames(k, old)])
    S = float(os.environ.get('SCALE', 1.5))
    W = int(max(sum(c.width for c in r) for r in rows) * S) + 20
    H = int(sum(max(c.height for c in r) for r in rows if r) * S) + 20
    sheet = Image.new('RGB', (W, H), GROUND)
    y = 10
    for r in rows:
        x = 10
        for c in r:
            c2 = c.resize((int(c.width * S), int(c.height * S)), Image.LANCZOS)
            sheet.paste(c2, (x, y), c2); x += c2.width
        y += int(max(c.height for c in r) * S) if r else 0
    sheet.save(out)

main()
