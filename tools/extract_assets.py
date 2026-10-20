"""Cut sidebar cameos, terrain previews and menu art out of the style mock.

Usage: python3 tools/extract_assets.py   (reads assets/source/mock.webp, writes assets/)
"""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..')
SRC = os.path.join(ROOT, 'assets', 'source', 'mock.webp')
OUT = os.path.join(ROOT, 'assets')

FACTIONS = ['usa', 'russia', 'china', 'eu', 'soviet']
# x ranges of the three card columns inside each faction panel
COLS = [
    [(17, 109), (117, 209), (217, 306)],
    [(335, 422), (430, 515), (522, 607)],
    [(634, 721), (728, 815), (823, 907)],
    [(936, 1026), (1034, 1122), (1130, 1217)],
    [(1245, 1332), (1340, 1427), (1435, 1522)],
]
# picture area (labels excluded) of each card row, and the names of the cards in it
ROWS = [
    ((210, 290), ['tank', 'ifv', 'heli']),
    ((328, 410), ['jet', 'sam', 'rifle']),
    ((476, 562), ['cc', 'barracks', 'factory']),
    ((588, 672), ['power', 'radar', 'airfield']),
]
TERRAIN_ROWS = [(726, 795), (816, 885)]
TERRAIN_NAMES = [
    ['urban', 'desert', 'forest', 'snow', 'coast', 'industrial'],
    ['taiga', 'tundra', 'mountain', 'frozenlake', 'river', 'industrial'],
    ['ricefields', 'mountainpass', 'urban', 'desert', 'jungle', 'coast'],
    ['countryside', 'city', 'forest', 'alpine', 'riverside', 'industrial'],
    ['siberia', 'postsoviet', 'steppe', 'volcanic', 'arctic', 'militarybase'],
]


def save(img, *path):
    p = os.path.join(OUT, *path)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    img.save(p, 'WEBP', quality=88, method=6)


def main():
    im = Image.open(SRC).convert('RGB')
    for f, cols in zip(FACTIONS, COLS):
        for (y0, y1), names in ROWS:
            for (x0, x1), name in zip(cols, names):
                save(im.crop((x0, y0, x1 + 1, y1 + 1)), 'cameos', f, name + '.webp')
    for fi, cols in enumerate(COLS):
        for ri, (y0, y1) in enumerate(TERRAIN_ROWS):
            for ci, (x0, x1) in enumerate(cols):
                name = TERRAIN_NAMES[fi][ri * 3 + ci]
                p = os.path.join(OUT, 'terrain', name + '.webp')
                if not os.path.exists(p):
                    save(im.crop((x0, y0, x1 + 1, y1 + 1)), 'terrain', name + '.webp')
    save(im.crop((30, 12, 410, 96)), 'ui', 'logo.webp')
    save(im.crop((840, 0, 1536, 108)), 'ui', 'worldmap.webp')
    save(im.crop((0, 908, 1536, 1024)), 'ui', 'banner.webp')


if __name__ == '__main__':
    main()
