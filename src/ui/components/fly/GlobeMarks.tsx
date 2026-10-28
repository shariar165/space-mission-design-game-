// The HTML over the globe, the same for the three.js globe and the flat one (spec: UI rule 41): a marker per
// target, the selected target's label, the orbit labels (the periapsis of a dipping pass with its drag-heating risk,
// a moon's apoapsis), the orbiter's name and the scan flash when an OBSERVE order lands. The flat globe places them
// as it renders; the 3D globe moves them every frame through `refs`. Every number is the engine's (TargetCard,
// ScienceTargetsView.orbit); the drawing itself is not to scale.
import type { CSSProperties, MutableRefObject } from 'react';
import type { MoonOrbitView, ScienceTargetsView, TargetCard } from '../../../engine/ops/index';
import type { TargetBody } from '../../../engine/targets';
import * as f from '../../format';
import { GLOBE_LABEL, labelPlace } from '../../sdGeometry';
import { FLY_WORDS, MOON_WORDS, SCIENCE, targetName } from '../../sdWords';

export interface GlobeProps {
  /** Which globe (spec: UI rule 44): its map, view and words. */
  body: TargetBody;
  cards: TargetCard[];
  orbit: ScienceTargetsView['orbit'];
  selected?: string;
  onPick?: (id: string) => void;
  /** Markers appear one by one (arrival transition): how many show. */
  shown?: number;
  phone: boolean;
  engineer: boolean;
  /** Reduced motion: the camera cuts, the flyover shows its middle. */
  still: boolean;
  robotName: string;
  /** Hold the overview (the arrival transition lands there); the camera goes to the selection afterwards. */
  overview?: boolean;
  /** An OBSERVE order just landed on this target: the orbiter flies over it with the scan flash (n restarts it). */
  flyover?: { targetId: string; n: number };
  /** The globe box (CSS px). */
  w: number;
  h: number;
  /** The Moon scene (spec: UI rule 45): Earth, the link, the far-side and shadow arcs, the trim burns (engine). */
  moon?: MoonOrbitView;
  /** Show the station-keeping tag (Moon 2 and Moon 3, which teach fuel; spec: UI rule 46). */
  trimTag?: boolean;
}

/** Where something sits on screen (CSS px from the box's top-left), and whether the globe hides it. */
export interface ScreenAt {
  x: number;
  y: number;
  front: boolean;
}

export interface GlobeLabel {
  k: string;
  s: string;
  /** A second small line (Moon: the far side, the mascons). */
  note?: string;
  eng?: string;
  tone?: string;
}
export interface GlobeLabels {
  sel?: GlobeLabel;
  peri?: GlobeLabel;
  apo?: GlobeLabel;
}

/** The labels for the target in view (words and engine numbers only). */
export function globeLabels(c: TargetCard | undefined, orbit: ScienceTargetsView['orbit'], engineer: boolean): GlobeLabels {
  if (!c) return {};
  const sub = c.kind === 'surface' ? f.latLon(c.lat_deg ?? 0, c.lon_deg ?? 0) : c.kind === 'moon' ? SCIENCE.moonSub(f.km(c.pass.apoapsis_m)) : SCIENCE.limbSub;
  const out: GlobeLabels = { sel: { k: SCIENCE.marker(f.pad2(c.ordinal), targetName(c.id)), s: sub, ...(c.farSide ? { note: MOON_WORDS.farTarget } : {}) } };
  if (c.moonTransfer) out.apo = { k: SCIENCE.orbitChange, s: SCIENCE.apoapsis(f.km(orbit.apoapsis_m), f.km(c.pass.apoapsis_m)), tone: c.riskLevel };
  else if (c.dips)
    out.peri = {
      k: `⚠ ${SCIENCE.risk[c.riskLevel]}`,
      s: SCIENCE.periapsis(f.km(orbit.periapsis_m), f.km(c.pass.periapsis_m)),
      tone: c.riskLevel,
      ...(engineer ? { eng: SCIENCE.dragEng(f.pct(c.risk, c.risk < 0.01 ? 2 : 1), f.num(c.dragFactor, 1)) } : {}),
    };
  else out.peri = { k: SCIENCE.risk[c.riskLevel], s: SCIENCE.periapsisNow(f.km(orbit.periapsis_m)), tone: c.riskLevel };
  return out;
}

/** A label's width estimate (px): its longest line in the CRT font (the sub lines are smaller). */
export const labelWidth = (l: GlobeLabel, phone: boolean) =>
  Math.max(l.k.length, 0.86 * l.s.length, 0.86 * (l.note?.length ?? 0), 0.86 * (l.eng?.length ?? 0)) * GLOBE_LABEL.charPx[phone ? 'phone' : 'desktop'];

const markState = (c: TargetCard, selected?: string) =>
  c.id === selected ? ' on' : c.state === 'home' || c.state === 'sent' ? ' done' : c.state !== 'ready' && c.state !== 'refused' ? ' ordered' : '';

const place = (at: ScreenAt | undefined) => (at ? { left: at.x, top: at.y } : undefined);

function Label({ name, l, at, w, phone, refs }: { name: string; l: GlobeLabel; at?: ScreenAt; w: number; phone: boolean; refs?: MutableRefObject<Record<string, HTMLElement | null>> }) {
  const width = labelWidth(l, phone);
  const spot = at ? labelPlace(name, at.x, w, width, phone) : undefined;
  return (
    <span
      ref={(e) => {
        if (refs) refs.current[`lbl:${name}`] = e;
      }}
      className={`sci-lbl ${name}${l.tone ? ` ${l.tone}` : ''}${spot?.left ? ' left' : ''}${spot?.below ? ' below' : ''}${at && !at.front ? ' behind' : ''}`}
      style={at && spot ? { left: spot.x, top: at.y } : undefined}
      data-w={Math.round(width)}
    >
      <span className="k">{l.k}</span>
      <span className="s">{l.s}</span>
      {l.note && <span className="s">{l.note}</span>}
      {l.eng && <span className="s eng">{l.eng}</span>}
    </span>
  );
}

interface MarksProps {
  p: GlobeProps;
  labels: GlobeLabels;
  /** Flat globe: where everything sits. 3D: left out; the frame loop moves the elements through `refs`. */
  at?: { marks: Record<string, ScreenAt>; sel?: ScreenAt; peri?: ScreenAt; apo?: ScreenAt; robot?: ScreenAt; scan?: ScreenAt };
  refs?: MutableRefObject<Record<string, HTMLElement | null>>;
}

export function GlobeMarks({ p, labels, at, refs }: MarksProps) {
  const shown = p.shown ?? p.cards.length;
  const reg = (k: string) => (e: HTMLElement | null) => {
    if (refs) refs.current[k] = e;
  };
  return (
    <>
      {p.cards.slice(0, shown).map((c) => {
        const a = at?.marks[c.id];
        return (
          <button
            key={c.id}
            ref={reg(`mark:${c.id}`)}
            type="button"
            className={`sci-mark${markState(c, p.selected)}${a && !a.front ? ' behind' : ''}`}
            style={place(a)}
            aria-label={targetName(c.id)}
            aria-pressed={c.id === p.selected}
            onClick={() => p.onPick?.(c.id)}
          >
            {f.num(c.ordinal)}
          </button>
        );
      })}
      {labels.sel && <Label name="sel" l={labels.sel} w={p.w} phone={p.phone} {...(at?.sel ? { at: at.sel } : {})} {...(refs ? { refs } : {})} />}
      {labels.peri && <Label name="peri" l={labels.peri} w={p.w} phone={p.phone} {...(at?.peri ? { at: at.peri } : {})} {...(refs ? { refs } : {})} />}
      {labels.apo && <Label name="apo" l={labels.apo} w={p.w} phone={p.phone} {...(at?.apo ? { at: at.apo } : {})} {...(refs ? { refs } : {})} />}
      <span ref={reg('lbl:robot')} className={`sci-robot-tag${at?.robot && !at.robot.front ? ' behind' : ''}`} style={place(at?.robot)} aria-hidden="true">
        {SCIENCE.orbiter(p.robotName.toUpperCase())}
      </span>
      {p.flyover && <span key={p.flyover.n} ref={reg('scan')} className={`sci-scan${p.still ? ' still' : ''}`} style={place(at?.scan)} aria-hidden="true" />}
    </>
  );
}

// ---------------------------------------------------------------------------
// The Moon scene's HTML (spec: UI rule 45; design 3d/Moon Globe.html): brackets round Earth and its label, the //
// break on the signal line, the trim-burn diamond on the ring, the link line, and a legend for the ring's dashed far
// side, its shadow beads and the trim burns (on the ring they would crowd each other and the targets). The globe
// decides where the marks sit (the flat globe as it renders, the 3D globe every frame through `refs`).

export interface MoonLabels {
  earth?: GlobeLabel;
  far?: GlobeLabel;
  shadow?: GlobeLabel;
  trim?: GlobeLabel;
}

/** The Moon scene's labels (words and engine numbers only). Picking a target leaves the target's own. */
export function moonLabels(m: MoonOrbitView, focused: boolean, trimTag: boolean): MoonLabels {
  const earth = { k: MOON_WORDS.earth(f.distance(m.earth.distance_m).toUpperCase(), f.secondsFine(m.earth.oneWay_s).toUpperCase()), s: MOON_WORDS.earthSub };
  if (focused) return {};
  const period = f.wholeMinutes(m.link.period_s);
  const sk = m.stationKeeping;
  return {
    earth,
    ...(m.now.farSide ? { far: { k: MOON_WORDS.far, s: MOON_WORDS.farSub(f.wholeMinutes(m.link.losPerOrbit_s), period) } } : {}),
    ...(m.now.shadow ? { shadow: { k: MOON_WORDS.shadow, s: MOON_WORDS.shadowSub(f.wholeMinutes(m.link.eclipsePerOrbit_s), period), tone: 'medium' } } : {}),
    ...(trimTag && sk ? { trim: { k: MOON_WORDS.trim, s: MOON_WORDS.trimNext(FLY_WORDS.duration(sk.nextBurn_s), f.speedFine(sk.pairDeltaV_ms).toUpperCase()) } } : {}),
  };
}

/** The link line's words now (the orbiter is in sight or behind the Moon). */
export const linkWords = (m: MoonOrbitView, up: boolean) => (up ? MOON_WORDS.linkUp(f.secondsFine(m.earth.oneWay_s).toUpperCase()) : MOON_WORDS.linkLost);

export interface MoonAt {
  earth?: ScreenAt & { r: number };
  brk?: ScreenAt & { angle: number };
  trim?: ScreenAt;
}

interface MoonMarksProps {
  p: GlobeProps;
  labels: MoonLabels;
  /** Flat globe: where everything sits, and whether the orbiter is linked. 3D: left out (the frame loop moves them). */
  at?: MoonAt;
  linked?: boolean;
  refs?: MutableRefObject<Record<string, HTMLElement | null>>;
}

export function MoonMarks({ p, labels, at, linked, refs }: MoonMarksProps) {
  const reg = (k: string) => (e: HTMLElement | null) => {
    if (refs) refs.current[k] = e;
  };
  const e = at?.earth;
  const legend = (['far', 'shadow', 'trim'] as const).filter((k) => labels[k]);
  return (
    <>
      <span
        ref={reg('earth')}
        className={`sci-earth-mark${e && !e.front ? ' behind' : ''}`}
        style={e ? { left: e.x, top: e.y, width: 2 * e.r + 18, height: 2 * e.r + 18 } : undefined}
        aria-hidden="true"
      />
      <span
        ref={reg('brk')}
        className={`sci-brk${e && !e.front ? ' behind' : ''}`}
        style={at?.brk ? ({ left: at.brk.x, top: at.brk.y, '--a': `${at.brk.angle.toFixed(3)}rad` } as CSSProperties) : undefined}
        aria-hidden="true"
      >
        {'//'}
      </span>
      {labels.trim && <span ref={reg('trim')} className="sci-trim" style={place(at?.trim)} aria-hidden="true" />}
      {labels.earth && <Label name="earth" l={labels.earth} w={p.w} phone={p.phone} {...(e ? { at: e } : {})} {...(refs ? { refs } : {})} />}
      {legend.length > 0 && (
        <ul className="sci-legend" aria-label={MOON_WORDS.legend}>
          {legend.map((k) => (
            <li key={k} className={k}>
              <span className="key" aria-hidden="true" />
              <span className="k">{labels[k]!.k}</span>
              <span className="s">{labels[k]!.s}</span>
            </li>
          ))}
        </ul>
      )}
      <span ref={reg('link')} className={`sci-link${linked === false ? ' lost' : ''}`} role="status">
        {linked !== undefined && p.moon ? linkWords(p.moon, linked) : null}
      </span>
    </>
  );
}
