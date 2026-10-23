// The Mars globe in three.js (spec: UI rule 41; Claude Design "Mars Globe", docs/design/3d/). The only 3D element in
// the game: the NASA surface map on a sphere in its true rust and ochre, a green graticule, the robot's orbit ring,
// the moons' rings and a reticle on each surface target, with the CRT's phosphor glow. Loaded on demand (its own
// chunk). The target markers are the same HTML buttons as the flat globe, placed each frame from the projection.
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { TargetCard } from '../../../engine/ops/index';
import { MARS_GLOBE } from '../../../engine/targets';
import * as f from '../../format';
import { GLOBE_MOON_AT, GLOBE_VIEW } from '../../sdGeometry';
import { SCIENCE, targetName } from '../../sdWords';
import { GLOBE_MIN_FPS, GLOBE_WATCH_MS } from '../../globeRules';

const D = Math.PI / 180;
/** Ring radii in Mars radii: a picture, not to scale (Phobos orbits at 2.8 R, Deimos at 6.9 R). */
const RINGS = { robot: 1.16, phobos: 1.34, deimos: 1.55 } as const;
/** One full turn of the globe takes this long (s): it turns slowly, like the design. */
const SPIN_S = 90;
/** Where the limb target is marked: a point on the lit edge (angle from +x). */
const LIMB_AT = 0.42;

const ll = (lat: number, lon: number, r = 1) =>
  new THREE.Vector3(r * Math.cos(lat * D) * Math.cos(lon * D), r * Math.sin(lat * D), -r * Math.cos(lat * D) * Math.sin(lon * D));

interface Props {
  cards: TargetCard[];
  selected?: string;
  onPick?: (id: string) => void;
  /** Canvas size in CSS px (the disc fills the middle 62% of the box, as the flat globe). */
  size: number;
  /** Markers appear one by one (arrival transition). */
  shown?: number;
  phone: boolean;
  /** The frame rate fell below the floor, or WebGL failed: the screen switches to the flat globe. */
  onSlow?: () => void;
}

export default function MarsGlobe3D({ cards, selected, onPick, size, shown = cards.length, phone, onSlow }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const marks = useRef<Record<string, HTMLButtonElement | null>>({});
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: !phone, alpha: true, preserveDrawingBuffer: true });
    } catch {
      onSlow?.();
      return;
    }
    const box = size / 0.62;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 2));
    renderer.setSize(box, box);
    renderer.domElement.className = 'sci-globe-gl';
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    // Fit the unit sphere to 62% of the box: distance = r / tan(fov/2) ÷ 0.62.
    camera.position.set(0, 0, 1 / Math.tan((camera.fov * D) / 2) / 0.62);
    camera.lookAt(0, 0, 0);

    const add = THREE.AdditiveBlending;
    const tex = new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}${MARS_GLOBE.file}`);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const surface = new THREE.MeshStandardMaterial({ map: tex, roughness: 1, metalness: 0, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.12 });
    const grid = new THREE.LineBasicMaterial({ color: 0x2f9a4c, transparent: true, opacity: 0.32, blending: add, depthWrite: false });
    const beam = new THREE.LineBasicMaterial({ color: 0x55ff84, transparent: true, opacity: 0.8, blending: add });
    const reticle = new THREE.MeshBasicMaterial({ color: 0xc8ffd2, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 });

    // The axis tilts the view's latitude toward the camera; the body turns, starting with the view's longitude in front.
    const axis = new THREE.Group();
    axis.rotation.x = GLOBE_VIEW.lat_deg * D;
    const body = new THREE.Group();
    const lon0 = -(GLOBE_VIEW.lon_deg + 90) * D;
    body.rotation.y = lon0;
    axis.add(body);
    scene.add(axis);

    const seg = phone ? [64, 48] : [128, 96];
    body.add(new THREE.Mesh(new THREE.SphereGeometry(1, seg[0], seg[1]), surface));

    // Graticule every 30°.
    const pts: THREE.Vector3[] = [];
    const n = phone ? 48 : 96;
    for (let lat = -60; lat <= 60; lat += 30) for (let k = 0; k < n; k++) pts.push(ll(lat, (k / n) * 360, 1.004), ll(lat, ((k + 1) / n) * 360, 1.004));
    for (let lon = 0; lon < 360; lon += 30) for (let k = 0; k < n / 2; k++) pts.push(ll(-90 + (k / (n / 2)) * 180, lon, 1.004), ll(-90 + ((k + 1) / (n / 2)) * 180, lon, 1.004));
    body.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), grid));

    // A reticle ring on each surface target.
    for (const c of cardsRef.current) {
      if (c.kind !== 'surface') continue;
      const p = ll(c.lat_deg ?? 0, c.lon_deg ?? 0, 1.006);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.112, 48), reticle);
      ring.position.copy(p);
      ring.lookAt(p.clone().multiplyScalar(2));
      body.add(ring);
    }

    // Rings: the robot's inclined orbit and the two moons' (equatorial).
    const ringLine = (r: number) => {
      const q: THREE.Vector3[] = [];
      for (let k = 0; k <= 180; k++) q.push(new THREE.Vector3(r * Math.cos((k / 180) * 2 * Math.PI), 0, r * Math.sin((k / 180) * 2 * Math.PI)));
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(q), beam);
    };
    const robotOrbit = ringLine(RINGS.robot);
    robotOrbit.rotation.set(-1.22, 0, 0.42);
    const robot = new THREE.Mesh(new THREE.OctahedronGeometry(0.035), new THREE.MeshBasicMaterial({ color: 0xffb547 }));
    robotOrbit.add(robot);
    const moons = new THREE.Group();
    moons.add(ringLine(RINGS.phobos), ringLine(RINGS.deimos));
    axis.add(robotOrbit, moons);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const sun = new THREE.DirectionalLight(0xffffff, 2.6);
    sun.position.set(-4, 1.6, 3.2);
    scene.add(sun);

    const v = new THREE.Vector3();
    const place = () => {
      for (const c of cardsRef.current) {
        const m = marks.current[c.id];
        if (!m) continue;
        let front = true;
        if (c.kind === 'surface') {
          v.copy(ll(c.lat_deg ?? 0, c.lon_deg ?? 0, 1.01)).applyMatrix4(body.matrixWorld);
          front = v.clone().normalize().dot(camera.position.clone().sub(v).normalize()) > 0.05;
        } else if (c.kind === 'limb') {
          v.set(Math.cos(LIMB_AT), Math.sin(LIMB_AT), 0);
        } else {
          const r = c.id === 'deimos' ? RINGS.deimos : RINGS.phobos;
          const a = GLOBE_MOON_AT[c.id === 'deimos' ? 'deimos' : 'phobos'];
          v.set(r * Math.cos(a), 0, r * Math.sin(a)).applyMatrix4(axis.matrixWorld);
        }
        v.project(camera);
        m.style.left = `${(v.x * 0.5 + 0.5) * 100}%`;
        m.style.top = `${(-v.y * 0.5 + 0.5) * 100}%`;
        m.classList.toggle('behind', !front);
      }
    };

    // Frame-rate watchdog over the first GLOBE_WATCH_MS, skipping the first second (the texture is still loading).
    let frames = 0;
    let t0 = performance.now();
    const start = t0;
    let last = t0;
    let fpsShown = 0;
    let slow = 0;
    renderer.setAnimationLoop((now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      body.rotation.y += ((2 * Math.PI) / SPIN_S) * dt;
      robot.position.set(RINGS.robot * Math.cos(now / 2600), 0, RINGS.robot * Math.sin(now / 2600));
      scene.updateMatrixWorld(true);
      renderer.render(scene, camera);
      place();
      frames++;
      if (now - t0 >= 1000) {
        fpsShown = (frames * 1000) / (now - t0);
        el.dataset.fps = String(Math.round(fpsShown));
        // Two slow seconds in a row, any time after the first second: one stall (a screenshot, a tab switch) is not
        // enough, but a device that cannot keep up gets the flat globe.
        if (now - start > 1000) {
          slow = fpsShown < GLOBE_MIN_FPS ? slow + 1 : 0;
          if (slow >= GLOBE_WATCH_MS / 1000) onSlow?.();
        }
        frames = 0;
        t0 = now;
      }
    });
    const lost = () => onSlow?.();
    renderer.domElement.addEventListener('webglcontextlost', lost);
    return () => {
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.dispose();
      tex.dispose();
      renderer.domElement.remove();
    };
  }, [size, phone]); // eslint-disable-line react-hooks/exhaustive-deps

  const sel = cards.find((c) => c.id === selected);
  return (
    <div ref={host} className="sci-globe gl" style={{ width: size / 0.62, height: size / 0.62 }} role="img" aria-label={SCIENCE.globeCredit} data-globe="3d">
      {cards.slice(0, shown).map((c) => {
        const state = c.id === selected ? ' on' : c.state === 'home' || c.state === 'sent' ? ' done' : c.state !== 'ready' && c.state !== 'refused' ? ' ordered' : '';
        return (
          <button
            key={c.id}
            ref={(b) => {
              marks.current[c.id] = b;
            }}
            type="button"
            className={`sci-mark${state}`}
            aria-label={targetName(c.id)}
            aria-pressed={c.id === selected}
            onClick={() => onPick?.(c.id)}
          >
            {f.num(c.ordinal)}
          </button>
        );
      })}
      {sel && !phone && <span className="sci-sel-tag">{targetName(sel.id)}</span>}
    </div>
  );
}
