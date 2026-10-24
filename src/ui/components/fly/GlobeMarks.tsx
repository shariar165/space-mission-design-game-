// The HTML over the Mars globe, the same for the three.js globe and the flat one (spec: UI rule 41): a marker per
// target, the selected target's label, the orbit labels (the periapsis of a dipping pass with its drag-heating risk,
// a moon's apoapsis), the orbiter's name and the scan flash when an OBSERVE order lands. The flat globe places them
// as it renders; the 3D globe moves them every frame through `refs`. Every number is the engine's (TargetCard,
// ScienceTargetsView.orbit); the drawing itself is not to scale.
import type { MutableRefObject } from 'react';
import type { ScienceTargetsView, TargetCard } from '../../../engine/ops/index';
import * as f from '../../format';
import { GLOBE_LABEL, labelPlace } from '../../sdGeometry';
import { SCIENCE, targetName } from '../../sdWords';

export interface GlobeProps {
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
  const out: GlobeLabels = { sel: { k: SCIENCE.marker(f.pad2(c.ordinal), targetName(c.id)), s: sub } };
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
  Math.max(l.k.length, 0.86 * l.s.length, 0.86 * (l.eng?.length ?? 0)) * GLOBE_LABEL.charPx[phone ? 'phone' : 'desktop'];

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
