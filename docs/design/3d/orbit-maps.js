// Procedural maps for the orbit view: Earth surface + clouds, solar photosphere, corona sprite.
const D = Math.PI / 180;
function makeFbm(seed) {
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const perm = new Uint16Array(512), vals = new Float32Array(256), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = rnd();
  const h = (x, y, z) => vals[perm[perm[perm[x] + y] + z]];
  const noise = (x, y, z) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const X = xi & 255, Y = yi & 255, Z = zi & 255, X1 = (X + 1) & 255, Y1 = (Y + 1) & 255, Z1 = (Z + 1) & 255;
    const l = (a, b, t) => a + (b - a) * t;
    return l(l(l(h(X, Y, Z), h(X1, Y, Z), u), l(h(X, Y1, Z), h(X1, Y1, Z), u), v), l(l(h(X, Y, Z1), h(X1, Y, Z1), u), l(h(X, Y1, Z1), h(X1, Y1, Z1), u), v), w);
  };
  return (x, y, z, o) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * noise(x * f + 17, y * f + 31, z * f + 7); n += a; a *= 0.5; f *= 2.03; } return s / n; };
}
const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
function eachPixel(W, H, fn) {
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5) / H * 180, cl = Math.cos(lat * D), y = Math.sin(lat * D);
    for (let i = 0; i < W; i++) {
      const lon = (i + 0.5) / W * 360 - 180, x = cl * Math.cos(lon * D), z = -cl * Math.sin(lon * D);
      const c = fn(x, y, z, lat, lon), o = (j * W + i) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = c[3] ?? 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

export function buildEarthMaps(W = 1024, H = 512) {
  const fbm = makeFbm(4242), fbm2 = makeFbm(777);
  const OCEAN_D = [14, 44, 104], OCEAN_S = [34, 104, 158], FOREST = [38, 72, 34], GRASS = [92, 104, 52], DRY = [146, 122, 74], DESERT = [196, 164, 108], ROCK = [104, 92, 78], TUNDRA = [118, 120, 100], ICE = [232, 238, 242];
  const surface = eachPixel(W, H, (x, y, z, lat) => {
    const n = fbm(x * 1.25, y * 1.25, z * 1.25, 6), m = fbm2(x * 2.2, y * 2.2, z * 2.2, 4), al = Math.abs(lat);
    const sea = 0.535;
    const ice = ss(70, 74, al + (m - 0.5) * 16);
    let c;
    if (n < sea) c = mix(OCEAN_D, OCEAN_S, ss(sea - 0.07, sea, n));
    else {
      const e = (n - sea) * 7, arid = ss(0.48, 0.62, m) * (1 - ss(36, 46, al)) * ss(8, 16, al);
      c = mix(FOREST, GRASS, ss(0.35, 0.6, m));
      c = mix(c, DRY, ss(0.5, 0.62, m) * 0.7);
      c = mix(c, DESERT, arid);
      c = mix(c, TUNDRA, ss(52, 64, al));
      c = mix(c, ROCK, ss(0.35, 0.8, e) * 0.8);
    }
    c = mix(c, ICE, ice);
    return c;
  });
  const fc = makeFbm(99);
  const clouds = eachPixel(W, H, (x, y, z, lat) => {
    const w = fc(x * 2 + 9, y * 2, z * 2, 3);
    const c = fc(x * 3.2 + w * 1.6, y * 5.5 + w, z * 3.2, 5);
    const band = 0.06 * Math.exp(-lat * lat / 60) + 0.05 * Math.exp(-Math.pow(Math.abs(lat) - 55, 2) / 120);
    const a = ss(0.5, 0.72, c + band);
    return [255, 255, 255, Math.round(a * 230)];
  });
  return { surface, clouds };
}

export function buildSunMap(W = 512, H = 256) {
  const fbm = makeFbm(1234);
  const A = [212, 70, 8], B = [255, 160, 40], C = [255, 236, 170];
  return eachPixel(W, H, (x, y, z) => {
    const g = fbm(x * 14, y * 14, z * 14, 3), b = fbm(x * 3, y * 3, z * 3, 3);
    const t = Math.min(1, Math.max(0, g * 0.8 + b * 0.5 - 0.1));
    return t < 0.5 ? mix(A, B, t / 0.5) : mix(B, C, (t - 0.5) / 0.5);
  });
}

export function buildGlowSprite(size = 256, stops) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const ctx = cv.getContext('2d'), g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, size, size);
  return cv;
}
