// Cadet gauges: the meters as metaphors (scale, battery, fuel tank, photos, coin jar). Fill levels are
// layout from the engine's demand ÷ supply ratio (cadetGauges); tapping a gauge reveals the real
// numbers from evaluateDesign() with the ⓘ source of every input. No equations here (Engineer only).
import { useId, useState } from 'react';
import { GAUGE_KEYS, type CadetGauges, type GaugeKey } from '../../engine/cadet';
import type { FullEvaluation } from '../../engine/index';
import type { Design, MeterStatus } from '../../engine/types';
import { GAUGE_ICON, GAUGE_LABEL, GAUGE_SHORT, GAUGE_STATUS } from '../cadetWords';
import * as f from '../format';
import { gaugeGeometry, meterView, scaleTilt } from '../meters';
import { SourceInfo } from './SourceInfo';
import { StatusIcon } from './icons';

const COLOR: Record<MeterStatus, string> = { ok: 'var(--ok)', warning: 'var(--warn)', over: 'var(--bad)' };

interface Props {
  gauges: CadetGauges;
  ev: FullEvaluation;
  design: Design;
  destName: string;
}

export function Gauges({ gauges, ev, design, destName }: Props) {
  const [open, setOpen] = useState<GaugeKey | undefined>();
  const panelId = useId();
  return (
    <section className="gauges" aria-label="Mission gauges">
      <div className="gauge-row">
        {GAUGE_KEYS.map((k) => {
          const g = gauges[k];
          return (
            <button
              key={k}
              type="button"
              className={`gauge ${g.status}${open === k ? ' open' : ''}`}
              aria-expanded={open === k}
              aria-controls={panelId}
              onClick={() => setOpen(open === k ? undefined : k)}
            >
              <span className="gauge-art" aria-hidden="true">
                <Art k={k} gauges={gauges} />
              </span>
              <span className="gauge-label">
                <span className="gl-long">{k === 'fuel' ? `Fuel to reach ${destName}` : GAUGE_LABEL[k]}</span>
                <span className="gl-short">{GAUGE_SHORT[k]}</span>
              </span>
              <span className="gauge-status" style={{ color: COLOR[g.status] }}>
                <StatusIcon status={g.status} size={13} />
                {GAUGE_STATUS[k][g.status]}
              </span>
            </button>
          );
        })}
      </div>
      {open && <Reveal k={open} ev={ev} design={design} id={panelId} onClose={() => setOpen(undefined)} />}
    </section>
  );
}

function Reveal({ k, ev, design, id, onClose }: { k: GaugeKey; ev: FullEvaluation; design: Design; id: string; onClose: () => void }) {
  const meterKey = { weight: 'mass', power: 'power', fuel: 'deltaV', photos: 'data', budget: 'cost' } as const;
  const m = ev.meters[meterKey[k]];
  const v = meterView(meterKey[k], m, ev, design);
  return (
    <div className="gauge-reveal" id={id} role="region" aria-label={`${GAUGE_LABEL[k]}: the real numbers`}>
      <div className="reveal-head">
        <span className="kicker">
          {GAUGE_ICON[k]} {GAUGE_LABEL[k]} · real numbers
        </span>
        <button type="button" className="popover-close" aria-label="Close" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="reveal-val">
        <span className="mono">
          {v.used} <span className="faint">/ {v.limit}</span>
        </span>
        <span className="faint">{v.sub}</span>
        {m.limitSource && <SourceInfo s={m.limitSource} title={`${GAUGE_LABEL[k]} limit`} />}
      </div>
      <div className="reveal-say">{v.say}</div>
      {m.limitSource?.isGameEstimate && <span className="badge est">LIMIT RESTS ON A GAME ESTIMATE</span>}
      <div className="reveal-inputs">
        {Object.entries(m.inputs).map(([key, s]) => (
          <span key={key} className="reveal-input">
            <span className="faint">{f.label(key)}</span>
            <span className="mono">{f.sourcedValue(s)}</span>
            <SourceInfo s={s} title={f.label(key)} />
          </span>
        ))}
      </div>
    </div>
  );
}

function Art({ k, gauges }: { k: GaugeKey; gauges: CadetGauges }) {
  const g = gauges[k];
  const c = COLOR[g.status];
  switch (k) {
    case 'weight': {
      const tilt = scaleTilt(g.ratio);
      return (
        <svg viewBox="0 0 64 64" width="64" height="64">
          <path d="M32 22 L24 56 H40 Z" fill="#41507a" />
          <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: '32px 22px', transition: 'transform 0.5s cubic-bezier(.3,1.6,.5,1)' }}>
            <path d="M6 22 H58" stroke={c} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M10 22 L4 36 H18 Z M54 22 L48 36 H60 Z" fill="none" stroke={c} strokeWidth="2" />
            <rect x="6" y="28" width="9" height="8" rx="2" fill="#f2b33d" />
            <path d="M54 36 V27 M50 31 L54 27 L58 31" stroke="#f0a35e" strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
          <circle cx="32" cy="22" r="3.5" fill={c} />
        </svg>
      );
    }
    case 'power':
    case 'fuel': {
      const { level, line } = gaugeGeometry(g.ratio, 'supply');
      const top = 10;
      const h = 46;
      return k === 'power' ? (
        <svg viewBox="0 0 64 64" width="64" height="64">
          <rect x="26" y="5" width="12" height="5" rx="1.5" fill="#8193b8" />
          <rect x="17" y={top} width="30" height={h} rx="6" fill="none" stroke="#8193b8" strokeWidth="2.5" />
          <rect x="20" y={top + 3 + (h - 6) * (1 - level)} width="24" height={(h - 6) * level} rx="3" fill={c} className="fill-anim" />
          <path d={`M14 ${top + 3 + (h - 6) * (1 - line)} H50`} stroke="#eaf0fa" strokeWidth="1.5" strokeDasharray="3 2" />
          <path d="M34 20 L27 34 H33 L30 46 L38 30 H32 Z" fill="#0a1430" opacity="0.55" />
        </svg>
      ) : (
        <svg viewBox="0 0 64 64" width="64" height="64">
          <rect x="16" y={top} width="32" height={h} rx="14" fill="none" stroke="#8193b8" strokeWidth="2.5" />
          <clipPath id="fuel-clip">
            <rect x="19" y={top + 3} width="26" height={h - 6} rx="11" />
          </clipPath>
          <rect x="16" y={top + 3 + (h - 6) * (1 - level)} width="32" height={(h - 6) * level} fill={c} clipPath="url(#fuel-clip)" className="fill-anim" />
          <path d={`M12 ${top + 3 + (h - 6) * (1 - line)} H52`} stroke="#eaf0fa" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      );
    }
    case 'photos': {
      const p = gauges.photos;
      return (
        <span className="photos-art">
          <svg viewBox="0 0 64 40" width="56" height="34">
            <rect x="6" y="10" width="52" height="28" rx="6" fill="none" stroke={c} strokeWidth="2.5" />
            <rect x="22" y="4" width="20" height="8" rx="2" fill={c} />
            <circle cx="32" cy="24" r="8" fill="none" stroke={c} strokeWidth="2.5" />
          </svg>
          <span className="photos-num" style={{ color: c }}>
            {f.photos(p.sent)}
            <span className="faint">/day</span>
          </span>
        </span>
      );
    }
    case 'budget': {
      const { level, line } = gaugeGeometry(g.ratio, 'demand');
      const top = 12;
      const h = 44;
      const coinsUp = Math.max(1, Math.round(level * 7));
      return (
        <svg viewBox="0 0 64 64" width="64" height="64">
          <path d={`M14 ${top} H50 L48 ${top + h} Q32 ${top + h + 4} 16 ${top + h} Z`} fill="none" stroke="#8193b8" strokeWidth="2.5" />
          <rect x="18" y={top - 6} width="28" height="6" rx="2" fill="#8193b8" />
          {Array.from({ length: coinsUp }, (_, i) => (
            <ellipse key={i} cx={i % 2 ? 34 : 30} cy={top + h - 4 - i * ((h - 8) / 7)} rx="12" ry="3.2" fill={c} stroke="#0a1430" strokeWidth="1" />
          ))}
          <path d={`M10 ${top + 2 + (h - 4) * (1 - line)} H54`} stroke="#eaf0fa" strokeWidth="1.5" strokeDasharray="3 2" />
        </svg>
      );
    }
  }
}
