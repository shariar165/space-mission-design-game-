"""Fetch the NASA pictures behind the Mars science targets and write the game's optimised copies.

Run from the repo root with the venv's Python (Pillow is pinned in requirements.txt):

    .venv\\Scripts\\python -I scripts\\fetch-targets.py [download_dir]

Every source is a public NASA (Photojournal) or USGS Astrogeology file; `src/data/targets.json` records each one's id,
credit line and usage terms, checked against its catalogue page. Originals are downloaded into `download_dir` (default:
a new temporary folder) and never committed. Outputs:

- public/targets/<target>.jpg   the picture the downlink drawer prints and the album shows (longest side ≤ 900 px)
- public/mars/globe-2k.jpg      the Mars surface map for the globe (equirectangular, 2048 × 1024)
- docs/design/signal-delay/assets/mars/*.jpg   the same pictures under the design mockups' names, so they render
"""
import os
import shutil
import sys
import tempfile
import urllib.request

from PIL import Image

PJ = 'https://assets.science.nasa.gov/content/dam/science/psd/photojournal/pia/'

# target id → (source url, crop as fractions (left, top, right, bottom) or None, design file name)
TARGETS = {
    'olympus-mons': (PJ + 'pia02/pia02982/PIA02982.jpg', None, 'olympus.jpg'),
    'valles-marineris': (PJ + 'pia00/pia00422/PIA00422.jpg', None, 'valles.jpg'),
    'north-polar-cap': (PJ + 'pia00/pia00161/PIA00161.jpg', None, 'northcap.jpg'),
    'phobos': (PJ + 'pia10/pia10368/PIA10368.jpg', None, 'phobos.jpg'),
    'deimos': (PJ + 'pia11/pia11826/PIA11826.jpg', None, 'deimos.jpg'),
    # A 5000 × 1280 horizon panorama: keep the middle 2:1 window, where the haze layers are.
    'limb': (PJ + 'pia26/pia26203/PIA26203.jpg', (0.244, 0.0, 0.756, 1.0), 'limb.jpg'),
}
GLOBE = ('https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/'
         '5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg')

MAX_SIDE = 900
GLOBE_SIZE = (2048, 1024)
DESIGN_DIR = os.path.join('docs', 'design', 'signal-delay', 'assets', 'mars')

Image.MAX_IMAGE_PIXELS = None  # the USGS map is 21,600 px wide: a trusted, known file


def fetch(url: str, folder: str) -> str:
    path = os.path.join(folder, url.rsplit('/', 1)[-1])
    if not os.path.exists(path):
        print('download', url)
        req = urllib.request.Request(url, headers={'User-Agent': 'signal-delay-game (educational)'})
        with urllib.request.urlopen(req, timeout=300) as r, open(path, 'wb') as f:
            shutil.copyfileobj(r, f)
    return path


def save(img: Image.Image, out: str, quality: int) -> None:
    os.makedirs(os.path.dirname(out), exist_ok=True)
    img.convert('RGB').save(out, 'JPEG', quality=quality, optimize=True, progressive=True)
    print(f'{out}: {img.width}×{img.height}, {os.path.getsize(out) // 1024} KB')


def main() -> None:
    folder = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix='nasa-targets-')
    os.makedirs(folder, exist_ok=True)
    for target, (url, crop, design_name) in TARGETS.items():
        with Image.open(fetch(url, folder)) as src:
            img = src.convert('RGB')
        if crop:
            w, h = img.size
            img = img.crop((round(crop[0] * w), round(crop[1] * h), round(crop[2] * w), round(crop[3] * h)))
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        out = os.path.join('public', 'targets', f'{target}.jpg')
        save(img, out, 82)
        os.makedirs(DESIGN_DIR, exist_ok=True)
        shutil.copyfile(out, os.path.join(DESIGN_DIR, design_name))
    with Image.open(fetch(GLOBE, folder)) as src:
        globe = src.convert('RGB').resize(GLOBE_SIZE, Image.Resampling.LANCZOS)
    save(globe, os.path.join('public', 'mars', 'globe-2k.jpg'), 85)
    # The mockup's flat globe is a photo of the disc; the game's Mars postcard (PIA00407, Viking) stands in for it.
    shutil.copyfile(os.path.join('public', 'postcards', 'mars-globe.jpg'), os.path.join(DESIGN_DIR, 'globe.jpg'))


if __name__ == '__main__':
    main()
