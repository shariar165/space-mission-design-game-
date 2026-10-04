// Power plan (mockup 1e): a dial with two handles (science duty and heater share) and a radio switch. The engine's
// powerPlanPreview gives every number: today's margin, the eclipse battery depth of discharge, photos per day.
import { useMemo, useRef, useState, type PointerEvent } from 'react';
import { defaultPowerPlan, powerPlanPreview, type OpsState, type PowerPlan } from '../../../engine/ops/index';
import type { MeterStatus } from '../../../engine/types';
import * as f from '../../format';
import { cssPct } from '../../opsGeometry';
import { STATUS_LABEL } from '../../opsWords';
import { StatusIcon } from '../icons';
import { SourceInfo } from '../SourceInfo';
import { SendIcon } from './opsIcons';

const C = 150;
const R = 132;
const r = 74;
const pt = (deg: number, rad: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + rad * Math.cos(a), C + rad * Math.sin(a)];
};
/** Ring segment between two fractions of the full circle (drawing only). */
function arc(f0: number, f1: number): string {
  if (f1 - f0 <= 1e-4) return '';
  const a0 = f0 * 360 + 0.6;
  const a1 = Math.max(a0 + 0.1, f1 * 360 - 0.6);
  const large = a1 - a0 > 180 ? 1 : 0;
  const [x0, y0] = pt(a0, R);
  const [x1, y1] = pt(a1, R);
  const [x2, y2] = pt(a1, r);
  const [x3, y3] = pt(a0, r);
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}A${r} ${r} 0 ${large} 0 ${x3.toFixed(1)} ${y3.toFixed(1)}Z`;
}

const worst = (...s: MeterStatus[]): MeterStatus => (s.includes('over') ? 'over' : s.includes('warning') ? 'warning' : 'ok');

interface Props {
  state: OpsState;
  engineer: boolean;
  destName: string;
  blocked: boolean;
  onSend: (plan: PowerPlan) => void;
  onClose: () => void;
}

export function PowerDial({ state, engineer, destName, blocked, onSend, onClose }: Props) {
  const [draft, setDraft] = useState<PowerPlan>(() => ({ ...state.plan, instruments: { ...state.plan.instruments } }));
  const [drag, setDrag] = useState<1 | 2>();
  const svg = useRef<SVGSVGElement>(null);
  const p = useMemo(() => powerPlanPreview(state, draft), [state, draft]);
  const ids = Object.keys(draft.instruments);
  const duty = ids.length ? Math.max(...ids.map((id) => draft.instruments[id] ?? 0)) : 0;
  const sp = p.split;
  const total = sp.bus_W + sp.scienceMax_W + sp.heatersMax_W + sp.radioMax_W;
  // Ring fractions (drawing): bus, science, heaters, radio, clockwise from the top.
  const b1 = sp.bus_W / total;
  const s1 = b1 + (sp.scienceMax_W * duty) / total;
  const h1 = s1 + (sp.heatersMax_W * draft.heaters) / total;
  const rd = h1 + (draft.radio ? sp.radioMax_W / total : 0);

  const setScience = (d: number) => setDraft((x) => ({ ...x, instruments: Object.fromEntries(ids.map((id) => [id, Math.min(1, Math.max(0, d))])) }));
  const setHeaters = (h: number) => setDraft((x) => ({ ...x, heaters: Math.min(1, Math.max(0, h)) }));

  const fromPointer = (e: PointerEvent<SVGSVGElement>, which: 1 | 2) => {
    const box = svg.current?.getBoundingClientRect();
    if (!box) return;
    const x = ((e.clientX - box.left) / box.width) * 300 - C;
    const y = ((e.clientY - box.top) / box.height) * 300 - C;
    let deg = (Math.atan2(y, x) * 180) / Math.PI + 90;
    if (deg < 0) deg += 360;
    const at = deg / 360;
    if (which === 1 && sp.scienceMax_W > 0) setScience(((at - b1) * total) / sp.scienceMax_W);
    if (which === 2 && sp.heatersMax_W > 0) setHeaters(((at - s1) * total) / sp.heatersMax_W);
  };

  const status = worst(p.today.status, p.eclipse?.status ?? 'ok', p.cold || !draft.radio ? 'warning' : 'ok');
  const msg =
    p.today.status === 'over'
      ? 'Too much! The craft would have to switch things off today.'
      : p.eclipse?.status === 'over'
        ? `Too much! The batteries would run flat in ${destName}’s shadow.`
        : p.eclipse?.status === 'warning'
          ? 'More science, but the batteries run low in eclipse.'
          : p.cold
            ? 'Heaters are low: the fuel lines may get too cold, and cold parts fail more often.'
            : !draft.radio
              ? 'Radio is off: no photos go home until you switch it back on.'
              : p.eclipse
                ? 'A balanced plan. The batteries stay healthy through every eclipse.'
                : 'A balanced plan.';
  const [h1x, h1y] = pt(s1 * 360, (R + r) / 2);
  const [h2x, h2y] = pt(h1 * 360, (R + r) / 2);
  const changed = JSON.stringify(draft) !== JSON.stringify(state.plan);

  return (
    <section className="ops-panel ops-dial" aria-label="Power plan">
      <div className="ops-panel-head">
        <span className="h2">Power plan</span>
        <span className="ops-label">{engineer ? `AVAILABLE ${f.watts(p.today.available_W)} · NEED ${f.watts(p.today.required_W)}` : 'TODAY’S SHARE'}</span>
        <button type="button" className="ops-close" aria-label="Close power plan" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="ops-dial-grid">
        <svg
          ref={svg}
          viewBox="0 0 300 300"
          className="ops-dial-svg"
          role="img"
          aria-label="Power split: drag the white handles"
          onPointerMove={(e) => drag && fromPointer(e, drag)}
          onPointerUp={() => setDrag(undefined)}
          onPointerLeave={() => setDrag(undefined)}
        >
          <circle cx={C} cy={C} r={(R + r) / 2} fill="none" stroke="rgba(143,186,255,0.12)" strokeWidth={R - r} />
          <path d={arc(0, b1)} fill="#5b6b8c" />
          <path d={arc(b1, s1)} fill="#FF9F57" />
          <path d={arc(s1, h1)} fill="#F2C744" opacity="0.9" />
          <path d={arc(h1, rd)} fill="#8EC5FF" />
          <circle cx={C} cy={C} r="64" fill="#0E1B3B" />
          <text x={C} y="140" textAnchor="middle" fill="#A9B8D6" fontSize="13">
            {engineer ? 'P_sci' : 'Science'}
          </text>
          <text x={C} y="168" textAnchor="middle" fill="#EAF0FA" fontFamily="JetBrains Mono, monospace" fontSize="24">
            {engineer ? f.watts(sp.science_W) : f.pct(duty, 0)}
          </text>
          <circle className="ops-handle" cx={h1x} cy={h1y} r="11" onPointerDown={(e) => (e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId), setDrag(1))} />
          <circle className="ops-handle" cx={h2x} cy={h2y} r="11" onPointerDown={(e) => (e.currentTarget.ownerSVGElement?.setPointerCapture?.(e.pointerId), setDrag(2))} />
        </svg>
        <div className="ops-slices">
          <label className="ops-slice">
            <span className="ops-slice-head">
              <span className="sw sci" />
              <span className="h3">Science</span>
              <span className="mono">{engineer ? f.watts(sp.science_W) : f.pct(duty, 0)}</span>
            </span>
            <input type="range" min={0} max={100} value={Math.round(duty * 100)} aria-label="Science share" onChange={(e) => setScience(Number(e.target.value) / 100)} />
            <span className="muted">{engineer ? `${f.bits(p.science_bitsPerDay)}/day · instruments` : `About ${f.photos(p.sciencePhotosPerDay)} photos a day`}</span>
          </label>
          <label className="ops-slice">
            <span className="ops-slice-head">
              <span className="sw heat" />
              <span className="h3">Heaters</span>
              <span className="mono">{engineer ? f.watts(sp.heaters_W) : f.pct(draft.heaters, 0)}</span>
            </span>
            <input type="range" min={0} max={100} value={Math.round(draft.heaters * 100)} aria-label="Heater share" onChange={(e) => setHeaters(Number(e.target.value) / 100)} />
            <span className={p.cold ? 'warn' : 'muted'}>{p.cold ? 'Fuel lines getting chilly' : 'Keeps fuel and parts warm'}</span>
          </label>
          <div className="ops-slice">
            <span className="ops-slice-head">
              <span className="sw radio" />
              <span className="h3">Radio</span>
              <button type="button" className="ops-switch" role="switch" aria-checked={draft.radio} aria-label="Radio" onClick={() => setDraft((x) => ({ ...x, radio: !x.radio }))}>
                <span />
              </button>
            </span>
            <span className="muted">{engineer ? `${f.watts(sp.radioMax_W)} DC · ${f.bits(p.downlink_bitsPerDay)}/day today` : draft.radio ? 'Sends photos home' : 'Off: nothing goes home'}</span>
          </div>
        </div>
      </div>
      <div className={`ops-dial-msg s-${status}`}>
        <span className={`chip ${status}`}>
          <StatusIcon status={status} />
          {STATUS_LABEL[status]}
        </span>
        <div className="b">{msg}</div>
        {p.eclipse && (
          <div className="ops-lowest">
            <span className="muted">Battery at its lowest</span>
            <span className="ops-bar thin">
              <span className="ops-bar-fill" style={{ width: cssPct(p.eclipse.lowestCharge) }} />
              <span className="ops-bar-mark" style={{ left: cssPct(p.eclipse.lowestAllowedCharge) }} />
            </span>
            <span className="mono">{f.pct(p.eclipse.lowestCharge, 0)}</span>
          </div>
        )}
        {engineer && (
          <div className="ops-eng-box mono">
            <div className="bp">{p.equation}</div>
            {p.eclipse && (
              <div>
                = {f.watts(p.eclipse.load_W)} × {f.lightTime(p.eclipse.season.longestEclipse_s)} / battery = {f.pct(p.eclipse.depthOfDischarge, 1)} · limit {f.pct(p.eclipse.limit, 0)}
              </div>
            )}
            <div>
              margin today {f.signedPct(p.today.margin, 1)}
              {Object.entries(p.inputs).map(([k, s]) => (
                <SourceInfo key={k} s={s} title={k} />
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="ops-panel-foot">
        <button type="button" className="btn ghost" onClick={() => setDraft(defaultPowerPlan(state.env))}>
          Reset to usual plan
        </button>
        <button type="button" className="cta" disabled={!changed || blocked} onClick={() => onSend(draft)}>
          <SendIcon />
          {blocked ? 'No contact' : 'Send plan'}
        </button>
      </div>
    </section>
  );
}
