#!/usr/bin/env python3
"""Photo ground textures for the terrain (assets/terrain/tex/*.webp).

Downloads CC0 ground photographs from Poly Haven (https://polyhaven.com, public domain),
shrinks them to 512 px and centres every channel on mid grey, keeping only the variation.
The game lays them over each map's own soil colours with a 'hard-light' blend, so one
photo serves every theatre.

    python3 build.py            # needs Pillow + numpy; caches downloads in ./cache
"""
import json, os, sys, urllib.request
import numpy as np
_o = urllib.request.build_opener(); _o.addheaders = [('User-Agent', 'sprite-tools')]; urllib.request.install_opener(_o)
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
OUT = os.path.join(HERE, '..', '..', 'assets', 'terrain', 'tex')
# name: contrast kept (1 = as photographed)
TEX = {
    'aerial_grass_rock': 1.0, 'aerial_rocks_04': 0.9, 'leafy_grass': 1.2, 'grass_ground': 1.2, 'sparse_grass': 1.1,
    'withered_grass': 1.2, 'forrest_ground_01': 1.0, 'dirt_aerial_03': 1.0, 'aerial_ground_rock': 1.0, 'aerial_mud_1': 1.0,
    'aerial_beach_01': 1.3, 'aerial_sand': 1.2, 'gravelly_sand': 1.0, 'dry_ground_01': 0.9, 'mud_cracked_dry_03': 0.9,
    'aerial_rocks_02': 0.9, 'aerial_rocks_01': 0.9, 'snow_02': 1.0, 'snow_field_aerial': 0.8, 'cliff_side': 0.9, 'rock_face': 1.0,
}

def fetch(name):
    os.makedirs(CACHE, exist_ok=True)
    p = os.path.join(CACHE, name + '.jpg')
    if not os.path.exists(p):
        with urllib.request.urlopen(f'https://api.polyhaven.com/files/{name}') as r:
            d = json.load(r)
        key = 'Diffuse' if 'Diffuse' in d else next(k for k in d if 'diff' in k.lower() or 'col' in k.lower())
        urllib.request.urlretrieve(d[key]['1k']['jpg']['url'], p)
    return p

os.makedirs(OUT, exist_ok=True)
for name, contrast in TEX.items():
    im = Image.open(fetch(name)).convert('RGB').resize((512, 512), Image.LANCZOS)
    a = np.asarray(im).astype(np.float32)
    # take out the slow gradient of each photo (uneven light): tiling stays invisible
    lowres = np.asarray(im.resize((8, 8), Image.BOX).resize((512, 512), Image.BICUBIC)).astype(np.float32)
    a = a - lowres * 0.5 - a.mean(axis=(0, 1)) * 0.5
    # mostly light and shade, with half of the photo's own colour shifts (the soil colours come from the map)
    a = a * 0.5 + a.mean(axis=2, keepdims=True) * 0.5
    a = np.clip(128 + a * contrast, 0, 255).astype(np.uint8)
    Image.fromarray(a).save(os.path.join(OUT, name + '.webp'), quality=82, method=6)
    print(name, os.path.getsize(os.path.join(OUT, name + '.webp')) // 1024, 'KB')
