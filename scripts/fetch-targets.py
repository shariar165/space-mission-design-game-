"""Fetch the NASA pictures behind the science targets (Mars and the Moon) and write the game's optimised copies.

Run from the repo root with the venv's Python (Pillow is pinned in requirements.txt):

    .venv\\Scripts\\python -I scripts\\fetch-targets.py [download_dir] [mars|moon|all]

Every source is a public NASA (Photojournal, SVS, PDS) or USGS Astrogeology file; `src/data/targets.json` and
`src/data/moonTargets.json` record each one's id, credit line and usage terms, checked against its catalogue page.
Originals are downloaded into `download_dir` (default: a new temporary folder) and never committed. Outputs:

- public/targets/<target>.jpg   the picture the downlink drawer prints and the album shows (longest side ≤ 900 px)
- public/mars/globe-2k.jpg      the Mars surface map for the globe (equirectangular, 2048 × 1024)
- public/moon/globe-2k.jpg      the Moon surface map for the globe (NASA SVS CGI Moon Kit, 2048 × 1024)
- docs/design/signal-delay/assets/mars/*.jpg   the same Mars pictures under the design mockups' names, so they render

The Moon pictures are LROC Narrow Angle Camera frames from the PDS archive (public domain; the LROC website's own
featured images are copyrighted, so they are not used). Each is the browse pyramid of the CDR product in the PDS
volume's EXTRAS/BROWSE folder. A raw NAC frame is a long strip, mirrored east-west and sometimes south-up, so the
script crops a square around the target from the frame's corner coordinates (catalogue page) and turns it north-up.
"""
import math
import os
import shutil
import sys
import tempfile
import urllib.request

from PIL import Image, ImageOps

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

PDS = 'https://pds.lroc.im-ldi.com/data/LRO-L-LROC-3-CDR-V1.0/'
# Two ways to cut a picture from a NAC strip:
# - 'square': a square around a point, from the frame's corners (lat, east lon: UL, UR, LL, LR, catalogue page), turned
#   north-up and east-right. Fields: browse pyramid, corners, centre (lat, lon), side in full-resolution pixels.
# - 'strip': a stretch of the strip (fractions of its lines) from one or more side-by-side frames at a pyramid level,
#   laid on its side so it reads as a landscape. For oblique views and the pole, where north-up means nothing.
#   A frame taken looking far off nadir is stretched along the strip; `squeeze` = cos(emission angle) undoes most of
#   that (approximately: the stretch depends on the look direction).
MOON = {
    # Tranquility Base: the lunar module at 0.67416° N, 23.47314° E (LROC 2016; Wagner et al. 2017), 0.40 m/px.
    'apollo-11': ('square', PDS + 'LROLRC_1009/EXTRAS/BROWSE/2011309/M175124932RC_pyr.tif',
                  ((1.11, 23.49), (1.11, 23.45), (0.15, 23.50), (0.15, 23.46)), (0.67416, 23.47314), 2000),
    # Tycho's central peak at sunrise, the oblique pair of 10 June 2011 (left and right NACs side by side).
    'tycho': ('strip', [PDS + 'LROLRC_1007/EXTRAS/BROWSE/2011161/M162350671LC_pyr.tif',
                        PDS + 'LROLRC_1007/EXTRAS/BROWSE/2011161/M162350671RC_pyr.tif'], 2, (0.22, 0.62), 1.0),
    # Shackleton, looking across the south pole on 8 June 2020 (4.0 m/px, emission 66.7°): the pole is on its rim
    # (line 0.63 of the frame) and its floor, in permanent shadow, is the dark bowl (centre at line 0.78).
    'shackleton': ('strip', [PDS + 'LROLRC_1043C/EXTRAS/BROWSE/2020160/M1346257675LC_pyr.tif'], 2, (0.60, 0.99),
                   math.cos(math.radians(66.72))),
    # Inside Tsiolkovskiy, by its central peak (0.68 m/px); the frame is 1° north of the crater's centre.
    'tsiolkovskiy': ('square', PDS + 'LROLRC_1001/EXTRAS/BROWSE/2009321/M113107391LC_pyr.tif',
                     ((-18.84, 128.46), (-18.84, 128.34), (-19.98, 128.45), (-19.98, 128.33)), (-19.41, 128.39), 5064),
}
MOON_GLOBE = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_2k.jpg'

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


def unit(lat: float, lon: float) -> tuple[float, float, float]:
    la, lo = math.radians(lat), math.radians(lon)
    return (math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la))


def frame_pixel(corners, point) -> tuple[float, float]:
    """Where (lat, lon) falls in the frame, as fractions (sample, line) from the UL corner.

    The corners and the point go onto the plane tangent at the frame's centre, then the bilinear map from
    (sample, line) to that plane is inverted by Newton's method (a raw NAC frame is close to a parallelogram).
    """
    vs = [unit(*c) for c in corners]
    c = [sum(v[k] for v in vs) for k in range(3)]
    n = math.sqrt(sum(x * x for x in c))
    c = [x / n for x in c]
    e = [-c[1], c[0], 0.0]
    if math.hypot(*e) < 1e-9:
        e = [1.0, 0.0, 0.0]
    m = math.sqrt(sum(x * x for x in e))
    e = [x / m for x in e]
    nn = [c[1] * e[2] - c[2] * e[1], c[2] * e[0] - c[0] * e[2], c[0] * e[1] - c[1] * e[0]]

    def plane(v):
        d = sum(a * b for a, b in zip(v, c))
        return (sum(a * b for a, b in zip(v, e)) / d, sum(a * b for a, b in zip(v, nn)) / d)

    ul, ur, ll, lr = (plane(v) for v in vs)
    px, py = plane(unit(*point))
    s, t = 0.5, 0.5
    for _ in range(50):
        x = ul[0] * (1 - s) * (1 - t) + ur[0] * s * (1 - t) + ll[0] * (1 - s) * t + lr[0] * s * t - px
        y = ul[1] * (1 - s) * (1 - t) + ur[1] * s * (1 - t) + ll[1] * (1 - s) * t + lr[1] * s * t - py
        dxs = (ur[0] - ul[0]) * (1 - t) + (lr[0] - ll[0]) * t
        dys = (ur[1] - ul[1]) * (1 - t) + (lr[1] - ll[1]) * t
        dxt = (ll[0] - ul[0]) * (1 - s) + (lr[0] - ur[0]) * s
        dyt = (ll[1] - ul[1]) * (1 - s) + (lr[1] - ur[1]) * s
        det = dxs * dyt - dxt * dys
        s -= (x * dyt - y * dxt) / det
        t -= (y * dxs - x * dys) / det
    return s, t


def moon_picture(path: str, corners, centre, side: int) -> Image.Image:
    with Image.open(path) as src:
        w, h = src.size
        s, t = frame_pixel(corners, centre)
        print(f'  target at sample {s:.3f}, line {t:.3f} of the frame')
        side = min(side, w, h)
        cx = min(max(s * w, side / 2), w - side / 2)
        cy = min(max(t * h, side / 2), h - side / 2)
        left, top = round(cx - side / 2), round(cy - side / 2)
        img = src.crop((left, top, left + side, top + side))
    img = ImageOps.autocontrast(img, cutoff=0.5)
    ul, ur, ll, _ = corners
    # North up, east to the right: a raw NAC frame is mirrored, and some are south-up.
    if ul[0] < ll[0]:
        img = ImageOps.flip(img)
    if (ur[1] - ul[1] + 540) % 360 - 180 < 0:
        img = ImageOps.mirror(img)
    return img


EDGE = 0.01  # a NAC frame's outermost samples are dark: trim them so side-by-side frames join cleanly


def moon_strip(paths: list[str], level: int, lines: tuple[float, float], squeeze: float) -> Image.Image:
    parts = []
    for path in paths:
        with Image.open(path) as src:
            src.seek(level)
            w, h = src.size
            edge = round(EDGE * w)
            parts.append(src.crop((edge, round(lines[0] * h), w - edge, round(lines[1] * h))))
    out = Image.new('L', (sum(p.width for p in parts), parts[0].height))
    x = 0
    for p in parts:
        out.paste(p, (x, 0))
        x += p.width
    img = ImageOps.autocontrast(out, cutoff=0.5).rotate(90, expand=True)
    return img.resize((round(img.width * squeeze), img.height), Image.Resampling.LANCZOS) if squeeze < 1 else img


def moon(folder: str) -> None:
    for target, spec in MOON.items():
        print(target)
        if spec[0] == 'square':
            _, url, corners, centre, side = spec
            img = moon_picture(fetch(url, folder), corners, centre, side)
        else:
            _, urls, level, lines, squeeze = spec
            img = moon_strip([fetch(u, folder) for u in urls], level, lines, squeeze)
        img.thumbnail((MAX_SIDE, MAX_SIDE), Image.Resampling.LANCZOS)
        save(img, os.path.join('public', 'targets', f'{target}.jpg'), 82)
    with Image.open(fetch(MOON_GLOBE, folder)) as src:
        globe = src.convert('RGB').resize(GLOBE_SIZE, Image.Resampling.LANCZOS)
    save(globe, os.path.join('public', 'moon', 'globe-2k.jpg'), 85)


def mars(folder: str) -> None:
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


def main() -> None:
    folder = sys.argv[1] if len(sys.argv) > 1 else tempfile.mkdtemp(prefix='nasa-targets-')
    which = sys.argv[2] if len(sys.argv) > 2 else 'all'
    os.makedirs(folder, exist_ok=True)
    if which in ('mars', 'all'):
        mars(folder)
    if which in ('moon', 'all'):
        moon(folder)


if __name__ == '__main__':
    main()
