// Procedural equirectangular Moon map (lon -180..180 left→right, north up).
// Real maria, basins, named craters and ray systems at true selenographic
// positions; hill-shaded greys. Returns { map, glow } — glow is the emissive
// map (dim earthshine everywhere; Shackleton rim lit, floor in permanent shadow).
const D = Math.PI / 180;

export function buildMoonMap(W = 1600, H = 800) {
  let seed = 1969;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const perm = new Uint16Array(512), vals = new Float32Array(256), p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = rnd();
  function noise(x, y, z) {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = x - xi, yf = y - yi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    const X = xi & 255, Y = yi & 255, Z = zi & 255, X1 = (X + 1) & 255, Y1 = (Y + 1) & 255, Z1 = (Z + 1) & 255;
    const pX = perm[X], pX1 = perm[X1];
    const a0 = perm[pX + Y], a1 = perm[pX1 + Y], b0 = perm[pX + Y1], b1 = perm[pX1 + Y1];
    const c000 = vals[perm[a0 + Z]], c100 = vals[perm[a1 + Z]], c010 = vals[perm[b0 + Z]], c110 = vals[perm[b1 + Z]];
    const c001 = vals[perm[a0 + Z1]], c101 = vals[perm[a1 + Z1]], c011 = vals[perm[b0 + Z1]], c111 = vals[perm[b1 + Z1]];
    const e0 = c000 + (c100 - c000) * u, e1 = c010 + (c110 - c010) * u, f0 = c001 + (c101 - c001) * u, f1 = c011 + (c111 - c011) * u;
    const g0 = e0 + (e1 - e0) * v, g1 = f0 + (f1 - f0) * v;
    return g0 + (g1 - g0) * w;
  }
  const fbm = (x, y, z, o) => { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * noise(x * f + 17, y * f + 31, z * f + 7); n += a; a *= 0.5; f *= 2.03; } return s / n; };
  const sstep = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
  const vec = (lat, lon) => [Math.cos(lat * D) * Math.cos(lon * D), Math.sin(lat * D), -Math.cos(lat * D) * Math.sin(lon * D)];
  const angd = (v, x, y, z) => Math.acos(Math.max(-1, Math.min(1, v[0] * x + v[1] * y + v[2] * z))) / D;

  // [lat, lon, radius°, tint]  tint <0 bluish (Ti-rich), >0 brownish
  const MARIA = [
    [18, -52, 15, 0.1], [34, -55, 11, 0.1], [3, -56, 10, 0], [-8, -46, 8, 0], [42, -44, 9, 0.1], [24, -66, 8, 0], [10, -38, 8, 0],
    [32.8, -15.6, 15, 0.3], [28, 17.5, 9.5, 0.7], [8.5, 31.4, 10, -1], [17, 59.1, 7, 0.2], [-7.8, 51.3, 8, -0.3], [-15.2, 35.5, 5, 0],
    [-21.3, -16.6, 9, 0], [-24.4, -38.6, 5.5, 0], [13.3, 3.6, 3.5, 0.3], [-10, -23, 5, -0.2], [7.5, -30.9, 6, 0], [2, 0, 2.5, 0],
    [56, -30, 5, 0], [56, -12, 5, 0], [57, 5, 5, 0], [56, 22, 4.5, 0], [54, 38, 4, 0],
    [27.3, 147.9, 3.6, 0], [-19.4, -92.8, 3.6, 0], [1.3, 87.5, 4.5, 0], [13, 86.5, 3.5, 0], [-38.9, 93, 4, 0], [-46, 84, 3, 0], [-33.7, 163.5, 2.2, 0],
  ].map(([la, lo, r, t]) => [vec(la, lo), r, t]);
  const SPA = vec(-53, -169);

  // --- coarse pass: maria + regional albedo/relief ---
  const LW = 400, LH = 200, LN = LW * LH;
  const cM = new Float32Array(LN), cT = new Float32Array(LN), cA = new Float32Array(LN), cH = new Float32Array(LN);
  for (let j = 0; j < LH; j++) {
    const lat = 90 - (j + 0.5) / LH * 180, cl = Math.cos(lat * D), y = Math.sin(lat * D);
    for (let i = 0; i < LW; i++) {
      const lon = (i + 0.5) / LW * 360 - 180, x = cl * Math.cos(lon * D), z = -cl * Math.sin(lon * D);
      const n1 = fbm(x * 2.2, y * 2.2, z * 2.2, 5) - 0.5;
      const wx = x + 0.17 * (fbm(x * 3 + 40, y * 3, z * 3, 4) - 0.5), wy = y + 0.17 * (fbm(x * 3, y * 3 + 40, z * 3, 4) - 0.5), wz = z + 0.17 * (fbm(x * 3, y * 3, z * 3 + 40, 4) - 0.5), wl = Math.hypot(wx, wy, wz);
      let m = 0, t = 0;
      for (const [v, r, tt] of MARIA) {
        const d = angd(v, wx / wl, wy / wl, wz / wl); if (d > r * 1.7) continue;
        const k = sstep(r * 1.3, r * 0.6, d + n1 * r * 0.9); if (k > m) m = k; t += tt * k;
      }
      const dS = angd(SPA, x, y, z);
      const o = j * LW + i;
      cM[o] = m; cT[o] = Math.max(-1, Math.min(1, t));
      cA[o] = 0.66 + 0.22 * n1 - 0.1 * sstep(40, 12, dS);
      cH[o] = n1 * 0.8 - 1.2 * sstep(38, 8, dS);
    }
  }

  // --- fine pass ---
  const N = W * H, Hm = new Float32Array(N), A = new Float32Array(N), MM = new Float32Array(N), TN = new Float32Array(N), N4 = new Float32Array(N);
  const SH = new Float32Array(N).fill(9);
  const sinLat = new Float32Array(H), cosLat = new Float32Array(H), sinLon = new Float32Array(W), cosLon = new Float32Array(W);
  for (let j = 0; j < H; j++) { const la = (90 - (j + 0.5) / H * 180) * D; sinLat[j] = Math.sin(la); cosLat[j] = Math.cos(la); }
  for (let i = 0; i < W; i++) { const lo = ((i + 0.5) / W * 360 - 180) * D; sinLon[i] = Math.sin(lo); cosLon[i] = Math.cos(lo); }
  for (let j = 0; j < H; j++) {
    const cl = cosLat[j], y = sinLat[j];
    const fy = Math.min(LH - 1, Math.max(0, (j + 0.5) / H * LH - 0.5)), y0 = Math.floor(fy), y1 = Math.min(LH - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i < W; i++) {
      const x = cl * cosLon[i], z = -cl * sinLon[i];
      let fx = (i + 0.5) / W * LW - 0.5; if (fx < 0) fx += LW;
      const x0 = Math.floor(fx), x1 = (x0 + 1) % LW, tx = fx - x0;
      const q00 = y0 * LW + x0, q10 = y0 * LW + x1, q01 = y1 * LW + x0, q11 = y1 * LW + x1;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const S = a => a[q00] * w00 + a[q10] * w10 + a[q01] * w01 + a[q11] * w11;
      const n2 = fbm(x * 10 + 5, y * 10, z * 10, 3) - 0.5, n4 = fbm(x * 34 + 3, y * 34, z * 34, 2) - 0.5;
      const mm = sstep(0.15, 0.85, S(cM) + 0.4 * n2);
      const hi = S(cA) + 0.1 * n2 + 0.06 * n4, ma = 0.36 + 0.07 * n2 + 0.03 * n4;
      const o = j * W + i;
      A[o] = hi + (ma - hi) * mm; MM[o] = mm; TN[o] = S(cT) * mm; N4[o] = n4;
      Hm[o] = S(cH) + 0.18 * n2 * (1 - 0.7 * mm) - 0.25 * mm;
    }
  }

  // craters: type 0 fresh (bright), 1 degraded, 2 dark-floored, 3 Shackleton, 4 ordinary
  function crater(lat0, lon0, R, type) {
    const sl0 = Math.sin(lat0 * D), cl0 = Math.cos(lat0 * D), cL0 = Math.cos(lon0 * D), sL0 = Math.sin(lon0 * D);
    const ext = R * (type === 0 ? 2.2 : 1.7), extR = ext / R;
    const j0 = Math.max(0, Math.floor((90 - lat0 - ext) / 180 * H)), j1 = Math.min(H - 1, Math.ceil((90 - lat0 + ext) / 180 * H));
    const full = Math.abs(lat0) + ext > 87;
    const lonExt = full ? 180 : ext / Math.cos((Math.abs(lat0) + ext) * D) * 1.05;
    const i0 = full ? 0 : Math.floor((lon0 - lonExt + 180) / 360 * W), i1 = full ? W - 1 : Math.ceil((lon0 + lonExt + 180) / 360 * W);
    const depth = 0.25 * Math.pow(R, 0.6) * (type === 1 ? 0.4 : 1), flat = type === 1 || R > 1.1, rimW = type === 1 ? 0.26 : 0.14;
    for (let j = j0; j <= j1; j++) {
      const a = sinLat[j] * sl0, b = cosLat[j] * cl0;
      for (let ii = i0; ii <= i1; ii++) {
        const i = ((ii % W) + W) % W;
        const d = Math.acos(Math.min(1, a + b * (cosLon[i] * cL0 + sinLon[i] * sL0))) / D / R;
        if (d > extR) continue;
        const o = j * W + i;
        let dh = d < 1 ? -depth * (flat ? 1 - sstep(0.68, 1, d) : 1 - d * d) : 0;
        dh += depth * 0.3 * Math.exp(-Math.pow((d - 1) / rimW, 2));
        if (type !== 1 && d > 1) dh += depth * 0.12 * Math.exp(-(d - 1) / 0.35);
        if (R > 1.1 && type !== 1) dh += depth * 0.5 * Math.exp(-Math.pow(d / 0.13, 2));
        Hm[o] += dh;
        if (type === 0 && d < 1.6) A[o] += 0.08 * (1 - d / 1.6);
        if (type === 2) { const k = sstep(0.82, 0.66, d) * (1 - Math.exp(-Math.pow(d / 0.12, 2))); A[o] += (0.22 - A[o]) * k; MM[o] = Math.max(MM[o], k); }
        if (type === 3 && d < SH[o]) SH[o] = d;
      }
    }
  }
  const NAMED = [
    [-43.3, -11.2, 1.4, 0], [9.6, -20.1, 1.55, 0], [-58.4, -14.4, 3.7, 1], [51.6, -9.4, 1.65, 2], [8.1, -38, 0.5, 0], [23.7, -47.4, 0.65, 0],
    [-11.4, 26.4, 1.6, 4], [-9.3, -1.9, 2.5, 1], [-5.2, -68.6, 2.9, 2], [-8.9, 61, 2.2, 4], [-25.1, 60.4, 2.9, 4], [-20.4, 129.1, 3.0, 2],
    [-4, -157.4, 7.5, 1], [2.6, -128.7, 9, 1], [-36.1, -151.8, 7.5, 1], [-89.9, 0, 1.6, 3], [16.1, 46.8, 0.45, 0], [35.9, 102.8, 0.35, 0], [22.4, -163.1, 1.2, 0],
  ];
  for (let c = 0; c < 3600; c++) {
    const lat = Math.asin(2 * rnd() - 1) / D, lon = rnd() * 360 - 180;
    const R = Math.min(2.6, 0.11 * Math.pow(rnd(), -0.55));
    const ci = Math.min(LW - 1, Math.floor((lon + 180) / 360 * LW)), cj = Math.min(LH - 1, Math.floor((90 - lat) / 180 * LH));
    if (rnd() < cM[cj * LW + ci] * 0.8) continue;
    const u = rnd();
    crater(lat, lon, R, R > 0.45 && u < 0.35 ? 1 : u > 0.9 ? 0 : 4);
  }
  for (const [la, lo, R, t] of NAMED) crater(la, lo, R, t);

  // ray systems [lat, lon, craterR, length°, rays, strength]
  const RAYS = [[-43.3, -11.2, 1.4, 58, 30, 0.5], [9.6, -20.1, 1.55, 20, 20, 0.3], [8.1, -38, 0.5, 11, 12, 0.26], [23.7, -47.4, 0.65, 9, 10, 0.3], [16.1, 46.8, 0.45, 10, 8, 0.2], [22.4, -163.1, 1.2, 16, 14, 0.26], [35.9, 102.8, 0.35, 10, 10, 0.3]];
  for (const [lat0, lon0, Rc, len, n, str] of RAYS) {
    const v = vec(lat0, lon0), sl = Math.sin(lat0 * D), cl = Math.cos(lat0 * D), sL = Math.sin(lon0 * D), cL = Math.cos(lon0 * D);
    const east = [-sL, 0, -cL], north = [-sl * cL, cl, sl * sL];
    const rays = Array.from({ length: n }, () => [rnd() * Math.PI * 2, (0.35 + 0.65 * rnd()) * len, 0.25 + 0.6 * rnd()]);
    const j0 = Math.max(0, Math.floor((90 - lat0 - len) / 180 * H)), j1 = Math.min(H - 1, Math.ceil((90 - lat0 + len) / 180 * H));
    for (let j = j0; j <= j1; j++) {
      for (let i = 0; i < W; i++) {
        const x = cosLat[j] * cosLon[i], y = sinLat[j], z = -cosLat[j] * sinLon[i];
        const d = angd(v, x, y, z); if (d > len) continue;
        const az = Math.atan2(x * east[0] + z * east[2], x * north[0] + y * north[1] + z * north[2]);
        let r = 0;
        for (const [a, l, w] of rays) {
          if (d > l) continue;
          const da = az - a, c = Math.cos(da); if (c < 0) continue;
          const g = gauss(Math.sin(da) * d, w * (0.7 + d * 0.035)) * Math.pow(1 - d / l, 1.3);
          if (g > r) r = g;
        }
        const o = j * W + i;
        r *= 0.45 + 1.1 * Math.max(0, N4[o] + 0.5);
        A[o] += str * (r * 0.75 + 0.9 * gauss(d, Rc * 2.3)) * (d < Rc ? 0.5 : 1);
      }
    }
  }

  // hill shade + grey ramp
  const mk = () => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; return cv; };
  const cv = mk(), gv = mk();
  const ctx = cv.getContext('2d'), gtx = gv.getContext('2d'), img = ctx.createImageData(W, H), gim = gtx.createImageData(W, H), px = img.data, gp = gim.data;
  let Lx = -0.6, Ly = 0.5, Lz = 0.62; const Ll = Math.hypot(Lx, Ly, Lz); Lx /= Ll; Ly /= Ll; Lz /= Ll;
  const k = 3.6 * (W / 1600);
  for (let j = 0; j < H; j++) {
    const cl = Math.max(0.06, cosLat[j]), jn = Math.max(0, j - 1), js = Math.min(H - 1, j + 1);
    for (let i = 0; i < W; i++) {
      const o = j * W + i, ie = j * W + (i + 1) % W, iw = j * W + (i - 1 + W) % W;
      const gx = (Hm[ie] - Hm[iw]) / (2 * cl), gy = (Hm[jn * W + i] - Hm[js * W + i]) / 2;
      const nx = -gx * k, ny = -gy * k, nl = Math.hypot(nx, ny, 1);
      const sh = Math.max(0, (nx * Lx + ny * Ly + Lz) / nl);
      let v = Math.max(0, Math.min(1, Math.pow(A[o] * (0.5 + 0.6 * sh), 1.2) * 0.95));
      const t = TN[o], hl = 1 - MM[o];
      let r = v * (1 + 0.045 * t) + 0.012 * hl, g = v, b = v * (1 - 0.06 * t) - 0.008 * hl;
      let gl = 0.22;
      const s = SH[o];
      if (s < 1.6) {
        const floor = sstep(0.9, 0.7, s), rim = Math.exp(-Math.pow((s - 1.04) / 0.13, 2));
        const f = 1 - floor * 0.96; r *= f; g *= f; b *= f;
        r += rim * 0.25; g += rim * 0.25; b += rim * 0.24;
        gl = 0.22 * (1 - floor) + rim * 1.8;
      }
      px[o * 4] = 255 * Math.min(1, r); px[o * 4 + 1] = 255 * Math.min(1, g); px[o * 4 + 2] = 255 * Math.min(1, Math.max(0, b)); px[o * 4 + 3] = 255;
      gp[o * 4] = Math.min(255, px[o * 4] * gl); gp[o * 4 + 1] = Math.min(255, px[o * 4 + 1] * gl); gp[o * 4 + 2] = Math.min(255, px[o * 4 + 2] * gl); gp[o * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0); gtx.putImageData(gim, 0, 0);
  return { map: cv, glow: gv };
}
