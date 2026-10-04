// Rescue History: pick a real lost mission, read its design sheet, inspect the clues from its failure
// report and find the bug before it launches. Facts, clues and the consequence come from rescue.ts.
import { useMemo, useState } from 'react';
import { inspectClue, rescueCase, rescueConsequence, rescueStars, RESCUE_MAX_STARS, type RescueCaseId } from '../../engine/rescue';
import type { Sourced } from '../../engine/types';
import { SourceInfo } from '../components/SourceInfo';
import { Star } from '../components/icons';
import * as f from '../format';

/** Cases still to come (names only; they become playable once their reports are sourced). */
const COMING = [
  { title: 'Genesis', year: 'capsule, 2004' },
  { title: 'Mars Polar Lander', year: 'lander, 1999' },
];

export function RescueSelect({ stars, onOpen, onMap }: { stars: Record<string, number>; onOpen: (id: RescueCaseId) => void; onMap: () => void }) {
  const mco = rescueCase('mco');
  return (
    <div className="cadet rescue">
      <div className="ckicker">🛟 Rescue History</div>
      <h1 className="ctitle">Save a mission that was lost</h1>
      <p className="chelper">Real spacecraft were lost to small mistakes. Read the file, find the bug, and fix it before launch.</p>
      <div className="case-list">
        <button type="button" className="case-card" onClick={() => onOpen('mco')}>
          <span className="case-art" aria-hidden="true">
            🛰
          </span>
          <span className="case-body">
            <span className="node-dest">{mco.year}</span>
            <span className="node-title">{mco.title}</span>
            <span className="node-concept">Lost on arrival at Mars</span>
            <span className="node-stars" aria-label={`${f.num(stars.mco ?? 0)} stars`}>
              {Array.from({ length: RESCUE_MAX_STARS.value }, (_, k) => (
                <Star key={k} filled={k < (stars.mco ?? 0)} size={18} />
              ))}
            </span>
          </span>
        </button>
        {COMING.map((c) => (
          <div key={c.title} className="case-card soon" aria-disabled="true">
            <span className="case-art" aria-hidden="true">
              🔒
            </span>
            <span className="case-body">
              <span className="node-dest">{c.year}</span>
              <span className="node-title">{c.title}</span>
              <span className="node-concept">Coming soon</span>
            </span>
          </div>
        ))}
      </div>
      <div className="cnav">
        <button type="button" className="btn-big ghost" onClick={onMap}>
          ← Map
        </button>
      </div>
    </div>
  );
}

export function RescueCaseView({ id, onSolved, onBack }: { id: RescueCaseId; onSolved: (stars: number) => void; onBack: () => void }) {
  const c = useMemo(() => rescueCase(id), [id]);
  const k = useMemo(() => rescueConsequence(id), [id]);
  const [open, setOpen] = useState<string>();
  const [wrong, setWrong] = useState<string[]>([]);
  const [found, setFound] = useState(false);
  const fx = c.facts;
  const attempts = wrong.length + 1;

  const accuse = (clueId: string) => {
    const clue = inspectClue(id, clueId);
    if (clue.isBug) {
      setFound(true);
      onSolved(rescueStars(attempts));
    } else if (!wrong.includes(clueId)) setWrong([...wrong, clueId]);
  };

  const Fact = ({ label, text, s }: { label: string; text: string; s: Sourced<unknown> }) => (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        <span className="mono">{text}</span>
        <SourceInfo s={s} title={label} />
      </dd>
    </div>
  );

  return (
    <div className="cadet rescue">
      <div className="ckicker">
        🛟 Rescue History · {c.year}
      </div>
      <h1 className="ctitle">{c.title}</h1>
      <p className="chelper">
        It was lost on arrival at Mars. Find the bug before it launches. <SourceInfo s={c.lost} title="What happened" />
      </p>

      <div className="rescue-grid">
        <section className="case-file" aria-label="Mission file">
          <div className="file-stamp">Mission file</div>
          <dl className="facts">
            <Fact label="Launch" text={f.isoDate(fx.launchDate.value)} s={fx.launchDate} />
            <Fact label="Rocket" text={fx.launchVehicle.value} s={fx.launchVehicle} />
            <Fact label="Launch mass" text={f.kg(fx.launchMass_kg.value)} s={fx.launchMass_kg} />
            <Fact label="Fuel" text={f.kg(fx.propellant_kg.value)} s={fx.propellant_kg} />
            <Fact label="Power at Mars" text={f.watts(fx.powerAtMars_W.value)} s={fx.powerAtMars_W} />
            <Fact label="Main engine" text={`${f.num(fx.mainEngineThrust_N.value)} N`} s={fx.mainEngineThrust_N} />
            <Fact label="Arrival" text={f.isoDate(fx.arrivalDate.value)} s={fx.arrivalDate} />
            <Fact label="Signal delay at Mars" text={f.clock(fx.lightTimeAtArrival_s.value)} s={fx.lightTimeAtArrival_s} />
            <Fact label="Planned lowest point" text={`${f.num(fx.plannedPeriapsis_km.value)} km`} s={fx.plannedPeriapsis_km} />
          </dl>
        </section>

        <section className="clues" aria-label="Clues">
          {!found ? (
            <>
              <h2 className="h2">Which one is the bug?</h2>
              {c.clues.map((clue) => {
                const isOpen = open === clue.id;
                const ruledOut = wrong.includes(clue.id);
                return (
                  <article key={clue.id} className={`clue${isOpen ? ' open' : ''}${ruledOut ? ' wrong' : ''}`}>
                    <button type="button" className="clue-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? undefined : clue.id)}>
                      <span aria-hidden="true">{ruledOut ? '✗' : '🔍'}</span>
                      <span className="clue-title">{clue.title}</span>
                    </button>
                    <p className="clue-text">{clue.text}</p>
                    {ruledOut && <p className="clue-verdict">{clue.verdict}</p>}
                    {isOpen && !ruledOut && (
                      <div className="clue-evidence">
                        <div className="evidence-head">
                          <span className="kicker">From the failure report</span>
                          <SourceInfo s={clue.evidence} title={clue.title} />
                        </div>
                        <p>{clue.evidence.value}</p>
                        <button type="button" className="btn-big" onClick={() => accuse(clue.id)}>
                          This is the bug!
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </>
          ) : (
            <Solved c={c} k={k} stars={rescueStars(attempts)} onBack={onBack} />
          )}
        </section>
      </div>
    </div>
  );
}

function Solved({ c, k, stars, onBack }: { c: ReturnType<typeof rescueCase>; k: ReturnType<typeof rescueConsequence>; stars: number; onBack: () => void }) {
  const bug = c.clues.find((x) => x.isBug)!;
  const fx = c.facts;
  // Altitude diagram (layout): the three published altitudes on one scale.
  const y = (km: number) => 150 - (km / 260) * 130;
  return (
    <div className="solved" role="status">
      <div className="solved-head">🎉 Bug found. Mission saved!</div>
      <div className="lb-stars" aria-label={`${stars} of ${RESCUE_MAX_STARS.value} stars`}>
        {Array.from({ length: RESCUE_MAX_STARS.value }, (_, i) => (
          <Star key={i} filled={i < stars} size={34} />
        ))}
      </div>
      <p className="solved-verdict">{bug.verdict}</p>
      <p className="solved-factor">
        Every push was <b className="mono">{f.num(k.factor.value, 2)}×</b> bigger than the navigators thought <SourceInfo s={k.factor} title="Pound-force to newtons" />. Over the trip, the craft drifted{' '}
        <b className="mono">{f.num(k.missedBy_km)} km</b> lower than planned.
      </p>
      <svg className="alt-chart" viewBox="0 0 320 170" role="img" aria-label={`Planned ${f.num(k.planned_km)} km, survivable ${f.num(k.survivable_km)} km, actual ${f.num(k.estimated_km)} km`}>
        <defs>
          <linearGradient id="alt-atm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ff7a4d" stopOpacity="0" />
            <stop offset="1" stopColor="#ff7a4d" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <rect x="0" y={y(k.survivable_km)} width="320" height={150 - y(k.survivable_km)} fill="url(#alt-atm)" />
        <path d="M0 150 Q160 140 320 150 V170 H0 Z" fill="#b8482a" />
        <line x1="10" x2="310" y1={y(k.planned_km)} y2={y(k.planned_km)} stroke="#3cd3c1" strokeWidth="3" />
        <text x="14" y={y(k.planned_km) - 6} className="alt-label ok">
          Plan · {f.num(k.planned_km)} km
        </text>
        <line x1="10" x2="310" y1={y(k.survivable_km)} y2={y(k.survivable_km)} stroke="#f2c744" strokeWidth="2" strokeDasharray="6 4" />
        <text x="14" y={y(k.survivable_km) - 6} className="alt-label warn">
          Lowest safe · {f.num(k.survivable_km)} km
        </text>
        <line x1="10" x2="310" y1={y(k.estimated_km)} y2={y(k.estimated_km)} stroke="#ff6b8a" strokeWidth="3" />
        <text x="306" y={y(k.estimated_km) + 16} textAnchor="end" className="alt-label bad">
          What happened · {f.num(k.estimated_km)} km
        </text>
      </svg>
      <p className="faint solved-note">
        Lowest point: plan <SourceInfo s={fx.plannedPeriapsis_km} title="Planned lowest point" /> · safe limit <SourceInfo s={fx.survivableMinPeriapsis_km} title="Lowest safe point" /> · estimate after the loss{' '}
        <SourceInfo s={fx.estimatedPeriapsis_km} title="Estimated lowest point" />
      </p>
      <button type="button" className="btn-big" onClick={onBack}>
        Back to Rescue History
      </button>
    </div>
  );
}
