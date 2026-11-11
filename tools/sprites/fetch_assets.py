#!/usr/bin/env python3
"""Fetches the public-domain (CC0) source material the sprite renderers use, from Poly Haven
(https://polyhaven.com), into ./cache (kept out of git: only the rendered sprites are committed).

    python3 fetch_assets.py            # materials + sky (for render.js)
    python3 fetch_assets.py models     # also the scanned trees, shrubs and rocks (for props.js, ~2 GB)

    cache/pbr/<name>_{diff,nor,rough}.jpg   photographed surfaces (render.html PHOTO_*)
    cache/hdri/<name>.hdr                   the sky that lights the models
    cache/<id>/<id>.gltf ...                scanned scenery (props.js PROPS)
"""
import json, os, sys, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, 'cache')
PBR = ['corrugated_iron_02', 'worn_corrugated_iron', 'concrete_wall_008', 'concrete_floor_worn_001', 'asphalt_02', 'painted_plaster_wall',
       'red_brick_03', 'green_metal_rust', 'clay_roof_tiles_02', 'concrete_panels', 'container_side', 'rusty_metal_02']
HDRI = ['kloofendal_48d_partly_cloudy_puresky']
MODELS = ['tree_small_02', 'island_tree_01', 'island_tree_02', 'searsia_lucida', 'fir_sapling_medium', 'dead_tree_trunk',
          'quiver_tree_01', 'quiver_tree_02', 'shrub_02', 'shrub_03', 'boulder_01', 'namaqualand_boulder_02', 'namaqualand_boulder_03',
          'namaqualand_boulder_04', 'namaqualand_boulder_05', 'namaqualand_boulder_06', 'rock_09', 'namaqualand_stones_01']

opener = urllib.request.build_opener(); opener.addheaders = [('User-Agent', 'sprite-tools')]; urllib.request.install_opener(opener)
def files(name): return json.load(urllib.request.urlopen(f'https://api.polyhaven.com/files/{name}'))
def get(url, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if not os.path.exists(path): urllib.request.urlretrieve(url, path)

for n in PBR:
    d = files(n)
    for key, suffix in [('Diffuse', 'diff'), ('nor_gl', 'nor'), ('Rough', 'rough')]:
        if key in d: get(d[key]['1k']['jpg']['url'], os.path.join(CACHE, 'pbr', f'{n}_{suffix}.jpg'))
    print('material', n)
for n in HDRI:
    get(files(n)['hdri']['1k']['hdr']['url'], os.path.join(CACHE, 'hdri', n + '.hdr')); print('sky', n)
if 'models' in sys.argv[1:]:
    for n in MODELS:
        g = files(n)['gltf']['1k']['gltf']
        get(g['url'], os.path.join(CACHE, n, n + '.gltf'))
        for rel, inc in g.get('include', {}).items(): get(inc['url'], os.path.join(CACHE, n, rel))
        print('model', n)
