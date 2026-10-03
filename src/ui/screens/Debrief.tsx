// Debrief (mockup: Debrief.dc.html). Numbers come from simulateMission(), evaluateDesign(),
// compareWithRealMission() and monteCarloMission(); this screen only picks words and units.
import { useMemo, useState } from 'react';
import { compareWithRealMission, type CompareMetric } from '../../engine/compare';
import { DESTINATIONS } from '../../engine/data';
import { monteCarloMission, type FullEvaluation, type SimulationResult } from '../../engine/index';
import { MARGIN_BAND, MAX_SCORE, scoreGrade, WEIGHTS, type Category } from '../../engine/scoring';
import type { Design, DestinationId } from '../../engine/types';
import { SourceInfo } from '../components/SourceInfo';
import { GradeChip } from '../components/StatusChip';
import { StatusIcon, Star } from '../components/icons';
import * as f from '../format';

const STAR_COUNT = 3;

const CATEGORY: Record<Category, string> = {
  science: 'Science return',
  success: 'Mission success',
  budget: 'Budget discipline',
  deltaV: 'Propellant (Δv) margin',
  power: 'Power margin',
  mass: 'Mass margin',
  crisis: 'Crisis handling',
};

const METRIC: Record<CompareMetric, string> = {
  wetMass: 'Launch mass',
  dryMass: 'Dry mass',
  propellant: 'Propellant',
  powerAtArrival: 'Power on arrival',
  deltaVCapability: 'Δv capability',
};

const PLANET: Record<DestinationId, string> = { moon: '#C9CED8', venus: '#E8C27A', mars: 'var(--mars)', bennu: '#7A6F66', jupiter: '#D9A86C' };

const PHASE: Record<string, string> = { launch: 'launch', cruise: 'cruise', arrival: 'arrival', science: 'science', return: 'return' };

interface Props {
  design: Design;
  ev: FullEvaluation;
  sim: SimulationResult;
  missionName: string;
  engineer: boolean;
  seed: number;
  onRetry: () => void;
  onEngineer: () => void;
}

export function Debrief({ design, ev, sim, missionName, engineer, seed, onRetry, onEngineer }: Props) {
  const dest = DESTINATIONS[design.destination];
  const cmp = useMemo(() => compareWithRealMission(design, ev), [design, ev]);
  const orbiter = dest.missionType === 'orbiter';

  const headline = !sim.launched
    ? 'Your craft never left the pad.'
    : sim.failedPhase === 'launch'
      ? 'The rocket failed on launch day.'
      : sim.failedPhase === 'cruise'
        ? `Lost in deep space on the way to ${dest.name}.`
        : sim.failedPhase === 'arrival'
          ? orbiter
            ? `${dest.name} was right there. The capture burn failed.`
            : `The rendezvous with ${dest.name} failed.`
          : sim.failedPhase === 'science'
            ? `You reached ${dest.name}, but the mission ended early.`
            : sim.failedPhase === 'return'
              ? 'The sample never made it home.'
              : sim.stars >= STAR_COUNT
                ? `Mission accomplished at ${dest.name}.`
                : sim.stars === 1
                  ? `You made it to ${dest.name}, but the science fell short.`
                  : `You made it to ${dest.name}. One more star to earn.`;

  const statusLabel = sim.completed
    ? orbiter
      ? `IN ${dest.name.toUpperCase()} ORBIT`
      : `MISSION COMPLETE`
    : sim.launched
      ? `LOST · ${PHASE[sim.failedPhase ?? ''] ?? ''} PHASE`.toUpperCase()
      : 'NOT LAUNCHED';

  return (
    <div className="debrief">
      <section className="hero">
        <div className="patch-col">
          <Patch name={missionName} planet={PLANET[design.destination]} />
          <div className="stars" aria-label={`${sim.stars} of ${STAR_COUNT} stars`}>
            {Array.from({ length: STAR_COUNT }, (_, i) => (
              <Star key={i} filled={i < sim.stars} />
            ))}
          </div>
          <div className="mono muted" style={{ fontSize: 12 }}>
            {sim.stars} OF {STAR_COUNT} STARS · {f.num(sim.score)} / {f.num(MAX_SCORE)} PTS
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span className={`chip ${sim.completed ? 'ok' : 'over'}`} style={{ height: 26, padding: '0 10px' }}>
                <StatusIcon status={sim.completed ? 'ok' : 'over'} />
                {statusLabel}
              </span>
              <span className="mono faint" style={{ fontSize: 12 }}>
                MISSION DAY {f.num(sim.endDay)} · {f.millionKm(sim.earthDistanceAtEnd_m).toUpperCase()} FROM EARTH
              </span>
            </div>
            <h1>{headline}</h1>
          </div>
          <div className="why-grid">
            <div className="why">
              <div className="kicker" style={{ marginBottom: 10 }}>
                Why
              </div>
              <Why sim={sim} ev={ev} destName={dest.name} />
            </div>
            <div className="next-star">
              <div className="kicker" style={{ color: 'var(--acc)' }}>
                {sim.stars >= STAR_COUNT ? 'All stars earned' : `For star ${sim.stars + 1}`}
              </div>
              <div>{sim.hint}</div>
            </div>
          </div>
          <div className="actions">
            <button className="cta" onClick={onRetry}>
              <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
                <path d="M4 10a6 6 0 1 0 2-4.5M4 3v3h3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Retry with this build
            </button>
            {!engineer && (
              <button className="btn ghost" onClick={onEngineer}>
                <span className="mono" style={{ color: 'var(--bp)', fontSize: 13 }}>
                  ƒ(x)
                </span>
                Try Engineer mode
              </button>
            )}
          </div>
        </div>
      </section>

      <div className="lower">
        <section className="card" aria-label="Score breakdown">
          <div className="card-head">
            <span className="t">Score breakdown</span>
            <span className="mono muted">
              {f.num(sim.score)} / {f.num(MAX_SCORE)}
            </span>
          </div>
          {sim.breakdown.map((b) => {
            const g = scoreGrade(b.score);
            const hl = sim.hintCategory === b.category && sim.stars < STAR_COUNT;
            return (
              <div key={b.category} className={`score-row${hl ? ' hl' : ''}`}>
                <div className="score-top">
                  <span className="n">{CATEGORY[b.category]}</span>
                  <GradeChip grade={g} />
                  <span className="s">{f.num(b.score)}</span>
                </div>
                <div className="score-bar">
                  <div className={g} style={{ width: `${Math.max(0, Math.min(1, b.score / MAX_SCORE)) * 100}%` }} />
                </div>
                <div className="score-note" style={hl ? { color: 'var(--ink)' } : undefined}>
                  {hl ? 'This is what stands between you and the next star. ' : ''}
                  {categoryNote(b.category, sim, ev)}
                </div>
              </div>
            );
          })}
          {engineer && <ScoreMath sim={sim} />}
        </section>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {cmp ? (
            <section className="card" aria-label={`Your design vs ${cmp.label}`}>
              <div className="card-head">
                <span className="t">Your design vs {cmp.label}</span>
                <span className="muted" style={{ fontSize: 13 }}>
                  same engine, same equations
                </span>
              </div>
              <div className="cmp">
                <div className="hd">METRIC</div>
                <div className="hd" style={{ textAlign: 'right', color: 'var(--acc)' }}>
                  YOU
                </div>
                <div className="hd" style={{ textAlign: 'right', color: 'var(--bp)' }}>
                  {cmp.label.split(' (')[0]?.toUpperCase()}
                </div>
                <div className="hd" style={{ paddingLeft: 24 }}>
                  DIFFERENCE
                </div>
                {cmp.rows.map((r) => {
                  const gap = r.metric === cmp.biggestGap;
                  const w = Math.min(50, Math.abs(r.relDiff) * 100);
                  return (
                    <div key={r.metric} style={{ display: 'contents' }} className={gap ? 'gap' : undefined}>
                      <div className={`lbl${gap ? ' gap' : ''}`}>
                        {METRIC[r.metric]}
                        {gap && <span className="badge acc">BIGGEST GAP</span>}
                      </div>
                      <div className={`num${gap ? ' gap' : ''}`}>
                        {f.num(r.you)}
                        <span className="unit"> {r.unit}</span>
                      </div>
                      <div className={`num${gap ? ' gap' : ''}`} style={{ color: 'var(--ink2)', display: 'flex', justifyContent: 'flex-end', gap: 6, alignItems: 'center' }}>
                        {f.num(r.them)}
                        <span className="unit"> {r.unit}</span>
                        <SourceInfo s={r.themSource} title={`${cmp.label} · ${METRIC[r.metric]}`} />
                      </div>
                      <div className={`diff${gap ? ' gap' : ''}`}>
                        <div className="diffbar">
                          <div className="mid" />
                          {r.relDiff < 0 && <div className="neg" style={{ width: `${w}%` }} />}
                          {r.relDiff > 0 && <div className="pos" style={{ width: `${w}%` }} />}
                        </div>
                        <span className="diffpct">{Math.abs(r.relDiff) < 0.0005 ? 'same' : f.signedPct(r.relDiff, Math.abs(r.relDiff) < 0.1 ? 1 : 0)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
              <GapNote cmp={cmp} />
              <div className="note-box">
                <span className="kicker" style={{ flex: 'none' }}>
                  History
                </span>
                <span>
                  {cmp.history}{' '}
                  {cmp.historyUrl && (
                    <a href={cmp.historyUrl} target="_blank" rel="noreferrer">
                      Source ↗
                    </a>
                  )}
                </span>
              </div>
            </section>
          ) : (
            <section className="card">
              <div className="card-head">
                <span className="t">Real-mission comparison</span>
              </div>
              <div className="muted">There is no sourced NASA preset for {dest.name} yet, so the game does not compare your design with a real mission here.</div>
            </section>
          )}
          {engineer && <MonteCarlo design={design} seed={seed} />}
        </div>
      </div>
    </div>
  );
}

function Why({ sim, ev, destName }: { sim: SimulationResult; ev: FullEvaluation; destName: string }) {
  const c = sim.crisis;
  if (!sim.launched) {
    return <p>The design had blockers, so it could not launch: {ev.blockers[0]}</p>;
  }
  return (
    <>
      {c &&
        (c.reached ? (
          <p>
            On day <b>{f.num(c.day)}</b> ({PHASE[c.phase]}): <b style={{ fontFamily: 'var(--body)', fontWeight: 600 }}>{c.title.toLowerCase()}</b>. You chose to{' '}
            {c.optionLabel.charAt(0).toLowerCase() + c.optionLabel.slice(1)}
            {c.deltaVSpent_ms > 0 && (
              <>
                , which used <b>{f.kg(c.propellantSpent_kg)}</b> of propellant ({f.speed(c.deltaVSpent_ms)})
              </>
            )}
            {c.budgetSpent_M > 0 && (
              <>
                , costing <b>{f.money(c.budgetSpent_M)}</b>
              </>
            )}
            {c.scienceDaysLost > 0 && (
              <>
                {' '}
                and lost <b>{f.days(c.scienceDaysLost)}</b> of science
              </>
            )}
            . {c.badOutcome ? `It went wrong, and the ${PHASE[sim.failedPhase ?? c.phase] ?? ''} phase was lost.` : 'It worked.'}
          </p>
        ) : (
          <p>
            A crisis ({c.title.toLowerCase()}) was waiting on day <b>{f.num(c.day)}</b>, but the mission ended before it came.
          </p>
        ))}
      {sim.failedPhase && !(c?.badOutcome && c.reached) && (
        <p>
          The {PHASE[sim.failedPhase]} phase failed on day <b>{f.num(sim.failureDay ?? sim.endDay)}</b>. Every phase has a base risk, and thin margins multiply it.
        </p>
      )}
      {sim.scienceDaysAchieved > 0 || sim.completed ? (
        <p>
          At {destName} the craft did <b>{f.num(sim.scienceDaysAchieved)}</b> of <b>{f.num(sim.plannedScienceDays)}</b> planned science days and sent home <b>{f.gbit(sim.downlinked_Gbit)}</b> of the{' '}
          <b>{f.gbit(sim.goal_Gbit)}</b> goal.{sim.radioLimited ? ' The radio, not the instruments, limited the science.' : ''}
        </p>
      ) : null}
    </>
  );
}

function categoryNote(cat: Category, sim: SimulationResult, ev: FullEvaluation): string {
  const band = `band ${f.pct(MARGIN_BAND.low.value, 0)}–${f.pct(MARGIN_BAND.high.value, 0)}`;
  switch (cat) {
    case 'science':
      return `${f.gbit(sim.downlinked_Gbit)} of ${f.gbit(sim.goal_Gbit)} downlinked.${sim.radioLimited ? ' The radio was the limit.' : ''}`;
    case 'success':
      return `${sim.phasesCompleted} of ${sim.totalPhases} phases completed.`;
    case 'budget':
      return `Development ${f.money(ev.details.cost.development_M)} against a ${f.money(ev.details.cost.cap_M)} cap${sim.crisis && sim.crisis.budgetSpent_M > 0 ? `, plus ${f.money(sim.crisis.budgetSpent_M)} for the crisis` : ''}.`;
    case 'deltaV':
      return `End-of-mission Δv margin ${f.signedPct(sim.endMargins.deltaV)} (${band}).`;
    case 'power':
      return `End-of-science power margin ${f.signedPct(sim.endMargins.power)} (${band}).`;
    case 'mass':
      return `Launch mass margin ${f.signedPct(sim.endMargins.mass)} (${band}).`;
    case 'crisis': {
      const c = sim.crisis;
      if (!c || !c.reached) return 'The crisis never came.';
      if (c.choseSafest) return c.badOutcome ? 'Safe choice, but unlucky.' : 'Safe choice, and it worked.';
      return c.badOutcome ? 'Risky choice, and it cost the mission.' : 'Risky choice, and you got away with it.';
    }
  }
}

function GapNote({ cmp }: { cmp: NonNullable<ReturnType<typeof compareWithRealMission>> }) {
  const r = cmp.rows.find((x) => x.metric === cmp.biggestGap);
  if (!r || Math.abs(r.relDiff) < 0.0005) return null;
  return (
    <div className="note-box">
      <span className="info-btn" style={{ borderColor: 'var(--bp)', color: 'var(--bp)' }} aria-hidden="true">
        i
      </span>
      <span>
        Your {METRIC[r.metric].toLowerCase()} is{' '}
        <b style={{ color: 'var(--ink)' }}>
          {f.pct(Math.abs(r.relDiff), 0)} {r.relDiff < 0 ? 'lower' : 'higher'}
        </b>{' '}
        than {cmp.label.split(' (')[0]}&apos;s: {f.num(r.you)} vs {f.num(r.them)} {r.unit}.
      </span>
    </div>
  );
}

function ScoreMath({ sim }: { sim: SimulationResult }) {
  return (
    <div className="eng">
      <div className="eq">Score = Σ wᵢ · sᵢ</div>
      <div className="math">
        <span className="hd">CATEGORY</span>
        <span className="hd">wᵢ</span>
        <span className="hd">sᵢ</span>
        <span className="hd">wᵢ·sᵢ</span>
        <span />
        {sim.breakdown.map((b) => (
          <span key={b.category} style={{ display: 'contents' }}>
            <span>{CATEGORY[b.category]}</span>
            <span>{f.num(b.weight, 2)}</span>
            <span>{f.num(b.score, 1)}</span>
            <span>{f.num(b.contribution, 1)}</span>
            <SourceInfo s={WEIGHTS[b.category]} title={`Weight: ${CATEGORY[b.category]}`} />
          </span>
        ))}
        <span style={{ color: 'var(--ink)' }}>Total</span>
        <span />
        <span />
        <span style={{ color: 'var(--ink)' }}>{f.num(sim.score, 1)}</span>
        <span />
      </div>
    </div>
  );
}

function MonteCarlo({ design, seed }: { design: Design; seed: number }) {
  const [mc, setMc] = useState<ReturnType<typeof monteCarloMission>>();
  return (
    <section className="card" aria-label="Monte Carlo">
      <div className="card-head">
        <span className="t">Fly it many times</span>
        <button className="btn-sm" onClick={() => setMc(monteCarloMission(design, { runs: 1000, seed }))}>
          Run Monte Carlo
        </button>
      </div>
      <div className="muted" style={{ fontSize: 13.5 }}>
        A good design lowers the risk but never removes it. The engine flies this exact design again and again, each time with new luck and a new crisis card.
      </div>
      {mc && (
        <div className="eng">
          <div>
            {f.num(mc.runs)} flights · success rate <span style={{ color: 'var(--ink)' }}>{f.pct(mc.successRate)}</span> · mean score {f.num(mc.meanScore, 1)}
          </div>
          <div>
            stars {mc.starsHistogram.map((n, i) => `${i}★ ${f.num(n)}`).join(' · ')}
          </div>
          <div>
            losses by phase{' '}
            {Object.entries(mc.failuresByPhase)
              .map(([ph, n]) => `${ph} ${f.num(n ?? 0)}`)
              .join(' · ') || 'none'}
          </div>
        </div>
      )}
    </section>
  );
}

function Patch({ name, planet }: { name: string; planet: string }) {
  return (
    <div className="patch">
      <svg viewBox="0 0 260 260" width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} fill="none" aria-hidden="true">
        <circle cx="196" cy="196" r="96" style={{ fill: planet }} />
        <ellipse cx="150" cy="150" rx="128" ry="54" transform="rotate(-28 150 150)" style={{ stroke: 'var(--bp)' }} strokeWidth="1.5" strokeDasharray="5 5" />
        <g transform="translate(70 88) rotate(-28)" style={{ stroke: 'var(--ink)' }} strokeWidth="1.5">
          <rect x="-10" y="-8" width="20" height="16" rx="2" style={{ fill: 'var(--ink)' }} />
          <rect x="-42" y="-6" width="28" height="12" fill="rgba(142,197,255,0.35)" />
          <rect x="14" y="-6" width="28" height="12" fill="rgba(142,197,255,0.35)" />
        </g>
        <circle cx="44" cy="40" r="1.5" style={{ fill: 'var(--ink2)' }} />
        <circle cx="120" cy="30" r="1" style={{ fill: 'var(--ink2)' }} />
        <circle cx="30" cy="150" r="1.2" style={{ fill: 'var(--ink2)' }} />
      </svg>
      <div className="patch-name">
        <span>{name}</span>
      </div>
    </div>
  );
}
