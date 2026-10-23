// Procedural equirectangular Mars map (lon -180..180 left→right, north up),
// built from real feature positions, hill-shaded, in natural rust/ochre tones.
// Smooth regional fields are computed on a coarse grid and upsampled;
// only fine detail and sharp landforms are evaluated at full resolution.
const D = Math.PI / 180;

export function buildMarsMap(W = 1600, H = 800) {
  let seed = 90210;
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
  const dot = (v, x, y, z) => v[0] * x + v[1] * y + v[2] * z;
  const dist = (v, x, y, z) => Math.acos(Math.max(-1, Math.min(1, dot(v, x, y, z)))) / D;
  const P = {
    tharsis: vec(-2, -105), olympus: vec(18.65, -133.8), alba: vec(40.5, -109.6), elysium: vec(25, 147),
    hellas: vec(-42.4, 70.5), argyre: vec(-49.7, -43.4), isidis: vec(13, 87), utopia: vec(46.7, 117.5),
    noctis: vec(-7, -102), arabia: vec(20, 5), amazonis: vec(16, -160), scap: vec(-87, -45),
  };
  const montes = [vec(-8.3, -120.1), vec(1.5, -113), vec(11.8, -104.5)];
  const dark = [
    [vec(8.4, 69.5), 8, 0.55], [vec(46.7, -22), 11, 0.45], [vec(-25, -40), 12, 0.42], [vec(-2, 2), 6, 0.5], [vec(-5, 20), 7, 0.35],
    [vec(-25, 145), 12, 0.45], [vec(-35, -155), 10, 0.38], [vec(-15, 100), 10, 0.38], [vec(-26, -85), 5, 0.35], [vec(-30, 120), 9, 0.3],
    [vec(60, 60), 10, 0.25], [vec(-10, -10), 8, 0.3],
  ];
  const vm = [[-6.5, -103], [-8, -96], [-8.5, -88], [-9.5, -80], [-11, -72], [-12.5, -65], [-13.5, -58], [-13, -51], [-11, -45], [-8, -40], [-5, -36]];
  const basin = (d, R, depth) => -depth * sstep(R, R * 0.25, d) + depth * 0.18 * Math.exp(-Math.pow((d - R) / (R * 0.16), 2));

  // --- coarse pass: regional relief + albedo ---
  const LW = 480, LH = 240, LN = LW * LH;
  const lH = new Float32Array(LN), lA = new Float32Array(LN), lDk = new Float32Array(LN), lS = new Float32Array(LN), lN1 = new Float32Array(LN);
  for (let j = 0; j < LH; j++) {
    const lat = 90 - (j + 0.5) / LH * 180, cl = Math.cos(lat * D), y = Math.sin(lat * D);
    for (let i = 0; i < LW; i++) {
      const lon = (i + 0.5) / LW * 360 - 180, x = cl * Math.cos(lon * D), z = -cl * Math.sin(lon * D);
      const n1 = fbm(x * 2, y * 2, z * 2, 5) - 0.5, n3 = fbm(x * 4 + 11, y * 4, z * 4, 4);
      const b = 8 + 20 * Math.cos((lon - 25) * D) + n1 * 30, south = sstep(-6, 6, b - lat);
      const dTh = dist(P.tharsis, x, y, z), dEl = dist(P.elysium, x, y, z), dHe = dist(P.hellas, x, y, z);
      let h = 1.4 * south + n1 * 1.3 + 2.6 * gauss(dTh, 24) + 1.1 * gauss(dist(P.alba, x, y, z), 7) + 0.8 * gauss(dEl, 9);
      h += basin(dHe, 19, 4.2) + basin(dist(P.argyre, x, y, z), 8.5, 2.6) + basin(dist(P.isidis, x, y, z), 6.5, 1.6) - 0.7 * gauss(dist(P.utopia, x, y, z), 22);
      const wx = x + 0.2 * (fbm(x * 3 + 40, y * 3, z * 3, 4) - 0.5), wy = y + 0.2 * (fbm(x * 3, y * 3 + 40, z * 3, 4) - 0.5), wz = z + 0.2 * (n3 - 0.5), wl = Math.hypot(wx, wy, wz);
      let dk = 0; for (const [v, s, k] of dark) dk += k * gauss(dist(v, wx / wl, wy / wl, wz / wl), s);
      const a = 0.5 + 0.26 * n1 + 0.14 * sstep(15, 3, dHe) + 0.08 * gauss(dTh, 20) + 0.07 * gauss(dist(P.arabia, x, y, z), 14) + 0.06 * gauss(dist(P.amazonis, x, y, z), 12);
      const o = j * LW + i; lH[o] = h; lA[o] = a; lDk[o] = dk * (0.5 + 0.9 * n3); lS[o] = south; lN1[o] = n1;
    }
  }

  // --- fine pass ---
  const Hm = new Float32Array(W * H), A = new Float32Array(W * H), N2 = new Float32Array(W * H);
  const cOM = Math.cos(4.5 * D), cMo = Math.cos(3 * D), cEl = Math.cos(3.6 * D), cNo = Math.cos(6 * D), cSc = Math.cos(9 * D);
  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5) / H * 180, cl = Math.cos(lat * D), y = Math.sin(lat * D);
    const fy = Math.min(LH - 1, Math.max(0, (j + 0.5) / H * LH - 0.5)), y0 = Math.floor(fy), y1 = Math.min(LH - 1, y0 + 1), ty = fy - y0;
    for (let i = 0; i < W; i++) {
      const lon = (i + 0.5) / W * 360 - 180, x = cl * Math.cos(lon * D), z = -cl * Math.sin(lon * D);
      let fx = (i + 0.5) / W * LW - 0.5; if (fx < 0) fx += LW;
      const x0 = Math.floor(fx), x1 = (x0 + 1) % LW, tx = fx - x0;
      const q00 = y0 * LW + x0, q10 = y0 * LW + x1, q01 = y1 * LW + x0, q11 = y1 * LW + x1;
      const w00 = (1 - tx) * (1 - ty), w10 = tx * (1 - ty), w01 = (1 - tx) * ty, w11 = tx * ty;
      const S = arr => arr[q00] * w00 + arr[q10] * w10 + arr[q01] * w01 + arr[q11] * w11;
      const n1 = S(lN1);
      const n2 = fbm(x * 9 + 5, y * 9, z * 9, 3) - 0.5, n4 = fbm(x * 28 + 3, y * 28, z * 28, 2) - 0.5;
      let h = S(lH) + n2 * (0.25 + 0.35 * S(lS));
      const kOM = dot(P.olympus, x, y, z);
      if (kOM > cOM) { const d = Math.acos(Math.min(1, kOM)) / D; h += 1.6 * sstep(4.2, 3.4, d) + 3.6 * Math.pow(sstep(3.4, 0, d), 1.2) - 1.3 * sstep(0.75, 0.35, d); }
      for (const v of montes) { const k = dot(v, x, y, z); if (k > cMo) { const d = Math.acos(Math.min(1, k)) / D; h += 3.0 * Math.pow(sstep(2.6, 0, d), 1.3) - 0.7 * sstep(0.55, 0.25, d); } }
      const kEl = dot(P.elysium, x, y, z);
      if (kEl > cEl) { const d = Math.acos(Math.min(1, kEl)) / D; h += 2.2 * Math.pow(sstep(3.2, 0, d), 1.2); }
      let vmA = 0;
      if (lat < 4 && lat > -22 && lon > -112 && lon < -30) {
        let md = 1e9, along = 0;
        for (let k = 0; k < vm.length - 1; k++) {
          const [la0, lo0] = vm[k], [la1, lo1] = vm[k + 1];
          const ax = (lo1 - lo0) * cl, ay = la1 - la0, px = (lon - lo0) * cl, py = lat - la0;
          const t = Math.max(0, Math.min(1, (px * ax + py * ay) / (ax * ax + ay * ay)));
          const dd = Math.hypot(px - ax * t, py - ay * t); if (dd < md) { md = dd; along = k + t; }
        }
        const w = 2.1 + 0.7 * Math.sin(along * 1.7) + n2 * 1.6 + (along > 3 && along < 7 ? 0.9 : 0);
        const cut = Math.pow(sstep(Math.max(0.6, w), 0, md), 0.8);
        h -= 2.0 * cut; vmA = cut;
        if (lon > -92 && lon < -60) { const md2 = Math.abs(lat - (-9.8 + (lon + 92) / 32 * -3.2 + 2.4)); h -= 1.8 * Math.pow(sstep(0.55, 0, md2), 0.7); }
      }
      const kNo = dot(P.noctis, x, y, z);
      if (kNo > cNo) { const d = Math.acos(Math.min(1, kNo)) / D; h -= 1.4 * sstep(6, 3, d) * sstep(0.58, 0.64, fbm(x * 40, y * 40, z * 40, 2)); }
      let a = S(lA) + 0.12 * n2 + 0.08 * n4 - 0.4 * sstep(0.06, 0.5, S(lDk) + n4 * 0.16) - 0.22 * vmA;
      if (lat > 70) {
        const edge = 80.5 + 5 * n1 + 2.5 * n2, cap = sstep(edge - 1.2, edge + 1.2, lat);
        if (cap > 0) { const tr = Math.sin(lon * D + (90 - lat) * 0.85 + n2 * 4); a = a * (1 - cap) + cap * (0.8 + 0.2 * sstep(-0.35, 0.35, tr)); h += cap * 0.6; }
      }
      if (lat < -76) { const k = dot(P.scap, x, y, z); if (k > cSc) { const sc = sstep(5, 3, Math.acos(Math.min(1, k)) / D + n2 * 3); a = a * (1 - sc) + sc * 0.92; } }
      const o = j * W + i; Hm[o] = h; A[o] = a; N2[o] = n2;
    }
  }

  // craters, denser on the southern highlands
  for (let c = 0; c < 2600; c++) {
    const lat = Math.asin(2 * rnd() - 1) / D, lon = rnd() * 360 - 180;
    const R = Math.min(3.4, 0.16 * Math.pow(rnd(), -0.58));
    const b = 8 + 20 * Math.cos((lon - 25) * D);
    if (lat > b && rnd() > 0.35) continue;
    if (Math.abs(lat) > 78) continue;
    const v = vec(lat, lon);
    if (dist(P.olympus, ...v) < 5 || (dist(P.tharsis, ...v) < 14 && rnd() > 0.25)) continue;
    const depth = 0.2 * Math.pow(R, 0.55) * (R > 1.8 ? 0.6 : 1), ext = R * 1.6, cl0 = Math.cos(lat * D);
    const j0 = Math.max(0, Math.floor((90 - lat - ext) / 180 * H)), j1 = Math.min(H - 1, Math.ceil((90 - lat + ext) / 180 * H));
    const lonExt = Math.min(180, ext / Math.max(0.08, cl0) * 1.1);
    const i0 = Math.floor((lon - lonExt + 180) / 360 * W), i1 = Math.ceil((lon + lonExt + 180) / 360 * W);
    for (let j = j0; j <= j1; j++) {
      const la = 90 - (j + 0.5) / H * 180, cl = Math.cos(la * D);
      for (let ii = i0; ii <= i1; ii++) {
        const i = ((ii % W) + W) % W, lo = (ii + 0.5) / W * 360 - 180;
        const d = Math.hypot((lo - lon) * cl, la - lat) / R;
        if (d > 1.6) continue;
        let dh = d < 1 ? -depth * (1 - d * d) : 0;
        dh += depth * 0.38 * Math.exp(-Math.pow((d - 1) / 0.17, 2));
        if (R > 1.4) dh += depth * 0.35 * Math.exp(-Math.pow(d / 0.14, 2));
        const o = j * W + i; Hm[o] += dh;
        if (d < 1) A[o] += 0.03 * (1 - d);
      }
    }
  }

  // hill shade + phosphor tint
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = img.data;
  let Lx = -0.62, Ly = 0.48, Lz = 0.62; const Ll = Math.hypot(Lx, Ly, Lz); Lx /= Ll; Ly /= Ll; Lz /= Ll;
  const k = 3.2 * (W / 1600);
  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5) / H * 180, cl = Math.max(0.06, Math.cos(lat * D));
    const jn = Math.max(0, j - 1), js = Math.min(H - 1, j + 1);
    for (let i = 0; i < W; i++) {
      const o = j * W + i, ie = j * W + (i + 1) % W, iw = j * W + (i - 1 + W) % W;
      const gx = (Hm[ie] - Hm[iw]) / (2 * cl), gy = (Hm[jn * W + i] - Hm[js * W + i]) / 2;
      const nx = -gx * k, ny = -gy * k, nl = Math.hypot(nx, ny, 1);
      const sh = Math.max(0, (nx * Lx + ny * Ly + Lz) / nl);
      let v = A[o] * (0.3 + 0.85 * sh) * (0.94 + 0.12 * N2[o]);
      v = Math.max(0, Math.min(1, Math.pow(v, 1.4) * 1.45));
      // rust/ochre ramp: dark basalt → rust → ochre dust → frost
      let r, g, b2;
      if (v < 0.45) { const t = v / 0.45; r = 0.07 + t * 0.55; g = 0.045 + t * 0.24; b2 = 0.035 + t * 0.13; }
      else if (v < 0.8) { const t = (v - 0.45) / 0.35; r = 0.62 + t * 0.24; g = 0.285 + t * 0.29; b2 = 0.165 + t * 0.19; }
      else { const t = (v - 0.8) / 0.2; r = 0.86 + t * 0.1; g = 0.575 + t * 0.33; b2 = 0.355 + t * 0.48; }
      px[o * 4] = 255 * r;
      px[o * 4 + 1] = 255 * g;
      px[o * 4 + 2] = 255 * b2;
      px[o * 4 + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}
