// The Mars globe in three.js (spec: UI rule 41; Claude Design "Mars Globe", docs/design/3d/), the hero of Science
// Targets. The only 3D element in the game: the NASA surface map on a sphere in its true rust and ochre, a green
// graticule, a reticle on each surface target, the moons on their rings, and the robot's orbit from the engine
// (drawn compressed, sdGeometry). Picking a target eases the camera to it; a dipping pass bends the ring down with
// its low arc tinted by the drag-heating risk; a moon shows the orbit change out to it. When an OBSERVE order lands
// the orbiter sweeps over the target. Loaded on demand (its own chunk). The markers and labels are the same HTML as
// the flat globe's (GlobeMarks), moved every frame from the projection.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { MARS_GLOBE } from '../../../engine/targets';
import { GLOBE_MIN_FPS, GLOBE_WATCH_MS } from '../../globeRules';
import {
  behindGlobe,
  easeInOutCubic,
  GLOBE_DRAG_ARC,
  GLOBE_EASE_MS,
  GLOBE_FLYOVER_ARC,
  GLOBE_FLYOVER_MS,
  GLOBE_SPIN_S,
  GLOBE_VIEW,
  globeDiscPx,
  globeFrame,
  globeOrbits,
  flyoverTheta,
  labelPlace,
  lonDelta,
  moonRing,
  orbitAt,
  orbitPoints,
  targetVec,
  type Vec3,
} from '../../sdGeometry';
import { SCIENCE } from '../../sdWords';
import { globeLabels, GlobeMarks, type GlobeProps } from './GlobeMarks';

const D = Math.PI / 180;
const FOV = 30;
/** The orbiter laps its (drawn) orbit in this many seconds when nothing is happening (a picture, not its period). */
const LAP_S = 24;
const RING_N = 180;
const DRAG_N = 48;

const ll = (lat: number, lon: number, r = 1) =>
  new THREE.Vector3(r * Math.cos(lat * D) * Math.cos(lon * D), r * Math.sin(lat * D), -r * Math.cos(lat * D) * Math.sin(lon * D));

const TONE: Record<string, number> = { none: 0x8dffa8, low: 0xffd27a, medium: 0xffb547, high: 0xff5a4a };

/** A line whose points are rewritten every frame. */
function liveLine(n: number, mat: THREE.LineBasicMaterial | THREE.LineDashedMaterial) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((n + 1) * 3), 3));
  const line = new THREE.Line(g, mat);
  line.frustumCulled = false;
  const set = (pts: Vec3[]) => {
    const a = g.attributes.position as THREE.BufferAttribute;
    pts.forEach((v, i) => a.setXYZ(i, v.x, v.y, v.z));
    a.needsUpdate = true;
    g.setDrawRange(0, pts.length);
    if (mat instanceof THREE.LineDashedMaterial) line.computeLineDistances();
  };
  return { line, set };
}

export default function MarsGlobe3D(props: GlobeProps & { onSlow?: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const live = useRef(props);
  live.current = props;
  const size = useRef<(w: number, h: number) => void>(undefined);
  const flyStart = useRef<{ targetId: string; t0: number } | undefined>(undefined);
  useEffect(() => {
    flyStart.current = props.flyover ? { targetId: props.flyover.targetId, t0: performance.now() } : undefined;
  }, [props.flyover?.n, props.flyover?.targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const phone = live.current.phone;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !phone, alpha: true, preserveDrawingBuffer: true });
    } catch {
      live.current.onSlow?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.25 : 1.5));
    renderer.domElement.className = 'sci-globe-gl';
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.setAttribute('aria-label', SCIENCE.globeCredit);
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.05, 100);
    let W = 1;
    let H = 1;
    size.current = (w, h) => {
      W = Math.max(1, w);
      H = Math.max(1, h);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    };
    size.current(live.current.w, live.current.h);

    const add = THREE.AdditiveBlending;
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${MARS_GLOBE.file}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const M = {
      surface: new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.14 }),
      grid: new THREE.LineBasicMaterial({ color: 0x2f9a4c, transparent: true, opacity: 0.32, blending: add, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: 0x39ff6a, transparent: true, opacity: 0.1, blending: add, side: THREE.BackSide, depthWrite: false }),
      reticle: new THREE.MeshBasicMaterial({ color: 0xc8ffd2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }),
      pulse: new THREE.MeshBasicMaterial({ color: 0xffb547, side: THREE.DoubleSide, transparent: true, opacity: 0.7, blending: add, depthWrite: false }),
      ring: new THREE.LineBasicMaterial({ color: 0x55ff84, transparent: true, opacity: 0.9, blending: add }),
      ghost: new THREE.LineDashedMaterial({ color: 0x2a9a4a, transparent: true, opacity: 0.8, blending: add, dashSize: 0.04, gapSize: 0.03 }),
      transfer: new THREE.LineDashedMaterial({ color: 0xb6ffc4, transparent: true, opacity: 0.95, blending: add, dashSize: 0.06, gapSize: 0.04 }),
      moon: new THREE.LineDashedMaterial({ color: 0x2a9a4a, transparent: true, opacity: 0.7, blending: add, dashSize: 0.03, gapSize: 0.05 }),
      drag: new THREE.PointsMaterial({ color: TONE.medium, size: phone ? 4 : 5, sizeAttenuation: false, transparent: true, blending: add, depthWrite: false }),
      robot: new THREE.MeshBasicMaterial({ color: 0xffb547 }),
      rock: new THREE.MeshStandardMaterial({ color: 0x58c070, emissive: 0x0d3318, roughness: 1, metalness: 0 }),
    };

    // The axis tilts the view's latitude toward the camera; the body turns the view's longitude to the front.
    const axis = new THREE.Group();
    const body = new THREE.Group();
    axis.add(body);
    scene.add(axis);
    const seg = phone ? [64, 48] : [128, 96];
    body.add(new THREE.Mesh(new THREE.SphereGeometry(1, seg[0], seg[1]), M.surface));
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.035, 48, 32), M.glow));

    // Graticule every 30°.
    const pts: THREE.Vector3[] = [];
    const n = phone ? 48 : 96;
    for (let lat = -60; lat <= 60; lat += 30) for (let k = 0; k < n; k++) pts.push(ll(lat, (k / n) * 360, 1.004), ll(lat, ((k + 1) / n) * 360, 1.004));
    for (let lon = 0; lon < 360; lon += 30) for (let k = 0; k < n / 2; k++) pts.push(ll(-90 + (k / (n / 2)) * 180, lon, 1.004), ll(-90 + ((k + 1) / (n / 2)) * 180, lon, 1.004));
    body.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), M.grid));

    // A reticle on each surface target, and an amber pulse on the selected one.
    const pulses: Record<string, THREE.Mesh> = {};
    for (const c of live.current.cards) {
      if (c.kind !== 'surface') continue;
      const p = ll(c.lat_deg ?? 0, c.lon_deg ?? 0, 1.006);
      const g = new THREE.Group();
      g.position.copy(p);
      g.lookAt(p.clone().multiplyScalar(2));
      g.add(new THREE.Mesh(new THREE.RingGeometry(0.1, 0.112, 48), M.reticle));
      const pulse = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.108, 48), M.pulse);
      g.add(pulse);
      pulses[c.id] = pulse;
      body.add(g);
    }

    // The orbits and the moons (view frame: rewritten every frame from sdGeometry).
    const ring = liveLine(RING_N, M.ring);
    const ghost = liveLine(RING_N, M.ghost);
    const transfer = liveLine(RING_N, M.transfer);
    // The low arc tinted by the drag-heating risk: beads, since WebGL lines are always one pixel wide.
    const dragGeo = new THREE.BufferGeometry();
    dragGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DRAG_N * 3), 3));
    const drag = new THREE.Points(dragGeo, M.drag);
    drag.frustumCulled = false;
    const moonLines: Record<string, ReturnType<typeof liveLine>> = {};
    const moonRocks: Record<string, THREE.Mesh> = {};
    for (const c of live.current.cards) {
      if (c.kind !== 'moon') continue;
      moonLines[c.id] = liveLine(120, M.moon);
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(c.id === 'deimos' ? 0.045 : 0.065, 1), M.rock);
      rock.scale.set(1.25, 0.9, 0.85);
      moonRocks[c.id] = rock;
      scene.add(moonLines[c.id]!.line, rock);
    }
    const robot = new THREE.Mesh(new THREE.OctahedronGeometry(0.04), M.robot);
    scene.add(ring.line, ghost.line, transfer.line, drag, robot);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-4, 1.6, 3.2);
    scene.add(sun);

    // The camera's state: where it looks (lat, lon), how close (zoom), easing from one target to the next.
    const cur = { lat: GLOBE_VIEW.lat_deg, lon: GLOBE_VIEW.lon_deg, zoom: 1 };
    let goalId: string | undefined | null = null;
    let from = { ...cur };
    let goal = { lat: cur.lat, lon: cur.lon, zoom: 1 };
    let t0 = performance.now();
    let theta = -GLOBE_FLYOVER_ARC;

    const v3 = new THREE.Vector3();
    const toScreen = (v: Vec3) => {
      v3.set(v.x, v.y, v.z).project(camera);
      return { x: (v3.x * 0.5 + 0.5) * W, y: (-v3.y * 0.5 + 0.5) * H };
    };
    const put = (key: string, v: Vec3 | undefined, front = true) => {
      const e = refs.current[key];
      if (!e) return;
      if (!v) return void (e.style.visibility = 'hidden');
      const s = toScreen(v);
      e.style.visibility = '';
      e.classList.toggle('behind', !front);
      if (key.startsWith('lbl:') && key !== 'lbl:robot') {
        const spot = labelPlace(key.slice(4), s.x, W, Number(e.dataset.w ?? 0), live.current.phone);
        e.classList.toggle('left', spot.left);
        e.classList.toggle('below', spot.below);
        s.x = spot.x;
      }
      e.style.left = `${s.x.toFixed(1)}px`;
      e.style.top = `${s.y.toFixed(1)}px`;
    };

    const frame = (now: number, dt: number) => {
      const P = live.current;
      const flying = flyStart.current;
      const focusId = flying?.targetId ?? (P.overview ? undefined : P.selected);
      const card = P.cards.find((c) => c.id === focusId);
      if (focusId !== goalId) {
        goalId = focusId;
        from = { ...cur };
        const g = globeFrame(card);
        goal = { lat: g.view.lat_deg, lon: g.view.lon_deg, zoom: g.zoom };
        t0 = now;
      }
      const e = P.still ? 1 : easeInOutCubic(Math.min(1, (now - t0) / GLOBE_EASE_MS));
      cur.lat = from.lat + (goal.lat - from.lat) * e;
      cur.lon = from.lon + lonDelta(from.lon, goal.lon) * e;
      cur.zoom = from.zoom + (goal.zoom - from.zoom) * e;
      // The overview turns slowly, like the design; a selected target stays put.
      if (!card && e >= 1 && !P.still) {
        cur.lon -= (360 / GLOBE_SPIN_S) * dt;
        from.lon = goal.lon = cur.lon;
      }
      const view = { lat_deg: cur.lat, lon_deg: cur.lon };
      axis.rotation.x = cur.lat * D;
      body.rotation.y = -(cur.lon + 90) * D;

      // Fit the disc to its radius at this zoom: the sphere's apparent half-angle a satisfies tan a = k, d = 1/sin a.
      const k = ((globeDiscPx(W, H, P.phone) * cur.zoom) / (H / 2)) * Math.tan((FOV * D) / 2);
      camera.position.set(0, 0, 1 / Math.sin(Math.atan(k)));
      camera.lookAt(0, 0, 0);
      camera.updateMatrixWorld();

      const o = globeOrbits(P.orbit, card, view);
      // A dipping pass bends down from the orbit now as the camera arrives.
      const rp = o.ghost ? o.ghost.rp + (o.rp - o.ghost.rp) * e : o.rp;
      const ra = o.ghost ? o.ghost.ra + (o.ra - o.ghost.ra) * e : o.ra;
      ring.set(orbitPoints(rp, ra, o.basis, -Math.PI, Math.PI, RING_N));
      ghost.line.visible = !!o.ghost;
      if (o.ghost) ghost.set(orbitPoints(o.ghost.rp, o.ghost.ra, o.basis, -Math.PI, Math.PI, RING_N));
      transfer.line.visible = !!o.transfer;
      if (o.transfer) transfer.set(orbitPoints(o.transfer.rp, o.transfer.ra, o.basis, -Math.PI, Math.PI, RING_N));
      drag.visible = o.dragArc;
      if (o.dragArc) {
        M.drag.color.setHex(TONE[card?.riskLevel ?? 'medium'] ?? TONE.medium!);
        const a = dragGeo.attributes.position as THREE.BufferAttribute;
        orbitPoints(rp, ra, o.basis, -GLOBE_DRAG_ARC, GLOBE_DRAG_ARC, DRAG_N - 1).forEach((v, i) => a.setXYZ(i, v.x, v.y, v.z));
        a.needsUpdate = true;
      }
      for (const c of P.cards) {
        if (c.kind !== 'moon' || !c.moonOrbit_m) continue;
        moonLines[c.id]?.set(moonRing(c.moonOrbit_m, view, 120));
        const m = targetVec(c, view);
        moonRocks[c.id]?.position.set(m.x, m.y, m.z);
      }
      for (const [id, pulse] of Object.entries(pulses)) {
        pulse.visible = id === focusId;
        pulse.scale.setScalar(1 + ((now / 1600) % 1) * 0.9);
      }

      // The orbiter: a slow lap, or the flyover's sweep across the periapsis over the target.
      if (flying) {
        const f = P.still ? 0.5 : Math.min(1, (now - flying.t0) / GLOBE_FLYOVER_MS);
        theta = flyoverTheta(f);
      } else if (!P.still) theta += ((2 * Math.PI) / LAP_S) * dt;
      const rb = orbitAt(rp, ra, o.basis, theta);
      robot.position.set(rb.x, rb.y, rb.z);
      robot.rotation.set(now / 900, now / 700, 0);

      // The HTML markers and labels.
      for (const c of P.cards) {
        const v = targetVec(c, view);
        put(`mark:${c.id}`, v, c.kind === 'surface' ? v.z > 0.05 : !behindGlobe(v));
      }
      const sel = card ? targetVec(card, view) : undefined;
      put('lbl:sel', sel, sel ? (card!.kind === 'surface' ? sel.z > 0.05 : !behindGlobe(sel)) : true);
      const peri = orbitAt(rp, ra, o.basis, 0);
      put('lbl:peri', peri, !behindGlobe(peri));
      const apo = o.transfer ? orbitAt(o.transfer.rp, o.transfer.ra, o.basis, Math.PI) : undefined;
      put('lbl:apo', apo, apo ? !behindGlobe(apo) : true);
      put('lbl:robot', rb, !behindGlobe(rb));
      if (flying) {
        const ft = P.cards.find((c) => c.id === flying.targetId);
        put('scan', ft ? targetVec(ft, view) : undefined);
      }
    };

    // Frame-rate watchdog: two slow seconds in a row, any time after the first (the texture is still loading).
    let frames = 0;
    let tw = performance.now();
    const start = tw;
    let last = tw;
    let slow = 0;
    renderer.setAnimationLoop((now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      frame(now, dt);
      renderer.render(scene, camera);
      frames++;
      if (now - tw >= 1000) {
        const fps = (frames * 1000) / (now - tw);
        el.dataset.fps = String(Math.round(fps));
        if (now - start > 1000) {
          slow = fps < GLOBE_MIN_FPS ? slow + 1 : 0;
          if (slow >= GLOBE_WATCH_MS / 1000) live.current.onSlow?.();
        }
        frames = 0;
        tw = now;
      }
    });
    const lost = () => live.current.onSlow?.();
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.Line || o instanceof THREE.Points) o.geometry.dispose();
      });
      Object.values(M).forEach((m) => m.dispose());
      renderer.dispose();
      tex.dispose();
      renderer.domElement.remove();
      size.current = undefined;
    };
  }, [props.phone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    size.current?.(props.w, props.h);
  }, [props.w, props.h]);

  const focusId = props.flyover?.targetId ?? (props.overview ? undefined : props.selected);
  const focus = props.cards.find((c) => c.id === focusId);
  const rD = globeDiscPx(props.w, props.h, props.phone);
  return (
    <div
      ref={host}
      className={`sci-globe gl${props.flyover ? ' flyover' : ''}`}
      data-globe="3d"
      data-focus={focus?.id ?? 'overview'}
      {...(props.flyover ? { 'data-flyover': props.flyover.targetId } : {})}
    >
      <div className="sci-globe-anchor" style={{ left: props.w / 2 - rD, top: props.h / 2 - rD, width: 2 * rD, height: 2 * rD }} />
      <GlobeMarks p={props} labels={globeLabels(focus, props.orbit, props.engineer)} refs={refs} />
    </div>
  );
}
