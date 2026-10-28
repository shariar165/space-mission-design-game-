// Rescue History: pick a real lost mission, read its design sheet, inspect the clues from its failure
// report and find the bug before it launches. Facts, clues and the consequence come from rescue.ts; the screen's
// words are RESCUE_WORDS, and the clues and the report's findings are cited texts said in the player's language
// (cited.ts), with ⓘ keeping the English original.
import { useMemo, useState } from 'react';
import { inspectClue, rescueCase, rescueConsequence, rescueStars, RESCUE_MAX_STARS, type RescueCaseId } from '../../engine/rescue';
import type { Sourced } from '../../engine/types';
import { SourceInfo } from '../components/SourceInfo';
import { Star } from '../components/icons';
import { said } from '../cited';
import * as f from '../format';
import { fullDate, RESCUE_WORDS } from '../sdWords';

/** Cases still to come (names only; they become playable once their reports are sourced). What each is: RESCUE_WORDS.coming. */
const COMING = ['Genesis', 'Mars Polar Lander'];

export function RescueSelect({ stars, onOpen, onMap }: { stars: Record<string, number>; onOpen: (id: RescueCaseId) => void; onMap: () => void }) {
  const mco = rescueCase('mco');
  return (
    <div className="cadet rescue">
      <div className="ckicker">{RESCUE_WORDS.kicker}</div>
      <h1 className="ctitle">{RESCUE_WORDS.title}</h1>
      <p className="chelper">{RESCUE_WORDS.helper}</p>
      <div className="case-list">
        <button type="button" className="case-card" onClick={() => onOpen('mco')}>
          <span className="case-art" aria-hidden="true">
            🛰
          </span>
          <span className="case-body">
            <span className="node-dest">{mco.year}</span>
            <span className="node-title">{mco.title}</span>
            <span className="node-concept">{RESCUE_WORDS.lostAtMars}</span>
            <span className="node-stars" aria-label={RESCUE_WORDS.stars(f.num(stars.mco ?? 0))}>
              {Array.from({ length: RESCUE_MAX_STARS.value }, (_, k) => (
                <Star key={k} filled={k < (stars.mco ?? 0)} size={18} />
              ))}
            </span>
          </span>
        </button>
        {COMING.map((title, i) => (
          <div key={title} className="case-card soon" aria-disabled="true">
            <span className="case-art" aria-hidden="true">
              🔒
            </span>
            <span className="case-body">
              <span className="node-dest">{RESCUE_WORDS.coming[i]}</span>
              <span className="node-title">{title}</span>
              <span className="node-concept">{RESCUE_WORDS.comingSoon}</span>
            </span>
          </div>
        ))}
      </div>
      <div className="cnav">
        <button type="button" className="btn-big ghost" onClick={onMap}>
          {RESCUE_WORDS.back}
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
  const W = RESCUE_WORDS;

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
      <div className="ckicker">{RESCUE_WORDS.kickerYear(c.year)}</div>
      <h1 className="ctitle">{c.title}</h1>
      <p className="chelper">
        {RESCUE_WORDS.caseHelper} <SourceInfo s={c.lost} title={RESCUE_WORDS.whatHappened} />
      </p>

      <div className="rescue-grid">
        <section className="case-file" aria-label={W.file}>
          <div className="file-stamp">{W.file}</div>
          <dl className="facts">
            <Fact label={W.fact.launch} text={fullDate(fx.launchDate.value)} s={fx.launchDate} />
            <Fact label={W.fact.rocket} text={fx.launchVehicle.value} s={fx.launchVehicle} />
            <Fact label={W.fact.launchMass} text={f.kg(fx.launchMass_kg.value)} s={fx.launchMass_kg} />
            <Fact label={W.fact.fuel} text={f.kg(fx.propellant_kg.value)} s={fx.propellant_kg} />
            <Fact label={W.fact.power} text={f.watts(fx.powerAtMars_W.value)} s={fx.powerAtMars_W} />
            <Fact label={W.fact.engine} text={`${f.num(fx.mainEngineThrust_N.value)} N`} s={fx.mainEngineThrust_N} />
            <Fact label={W.fact.arrival} text={fullDate(fx.arrivalDate.value)} s={fx.arrivalDate} />
            <Fact label={W.fact.delay} text={f.clock(fx.lightTimeAtArrival_s.value)} s={fx.lightTimeAtArrival_s} />
            <Fact label={W.fact.lowest} text={`${f.num(fx.plannedPeriapsis_km.value)} km`} s={fx.plannedPeriapsis_km} />
          </dl>
        </section>

        <section className="clues" aria-label={W.clues}>
          {!found ? (
            <>
              <h2 className="h2">{W.which}</h2>
              {c.clues.map((clue) => {
                const isOpen = open === clue.id;
                const ruledOut = wrong.includes(clue.id);
                return (
                  <article key={clue.id} className={`clue${isOpen ? ' open' : ''}${ruledOut ? ' wrong' : ''}`}>
                    <button type="button" className="clue-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? undefined : clue.id)}>
                      <span aria-hidden="true">{ruledOut ? '✗' : '🔍'}</span>
                      <span className="clue-title">{said(clue.title)}</span>
                    </button>
                    <p className="clue-text">{said(clue.text)}</p>
                    {ruledOut && <p className="clue-verdict">{said(clue.verdict)}</p>}
                    {isOpen && !ruledOut && (
                      <div className="clue-evidence">
                        <div className="evidence-head">
                          <span className="kicker">{W.fromReport}</span>
                          <SourceInfo s={clue.evidence} title={said(clue.title)} />
                        </div>
                        <p>{said(clue.evidence.value)}</p>
                        <button type="button" className="btn-big" onClick={() => accuse(clue.id)}>
                          {W.accuse}
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
  const W = RESCUE_WORDS;
  // Altitude diagram (layout): the three published altitudes on one scale.
  const y = (km: number) => 150 - (km / 260) * 130;
  return (
    <div className="solved" role="status">
      <div className="solved-head">{W.saved}</div>
      <div className="lb-stars" aria-label={W.starsOf(f.num(stars), f.num(RESCUE_MAX_STARS.value))}>
        {Array.from({ length: RESCUE_MAX_STARS.value }, (_, i) => (
          <Star key={i} filled={i < stars} size={34} />
        ))}
      </div>
      <p className="solved-verdict">{said(bug.verdict)}</p>
      <p className="solved-factor">
        {W.factor.before}
        <b className="mono">{f.num(k.factor.value, 2)}×</b>
        {W.factor.mid}
        <SourceInfo s={k.factor} title={W.factorTitle} />
        {W.factor.drift}
        <b className="mono">{f.num(k.missedBy_km)} km</b>
        {W.factor.after}
      </p>
      <svg className="alt-chart" viewBox="0 0 320 170" role="img" aria-label={W.chart(`${f.num(k.planned_km)} km`, `${f.num(k.survivable_km)} km`, `${f.num(k.estimated_km)} km`)}>
        <defs>
          <linearGradient id="alt-atm" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--sd-mars)" stopOpacity="0" />
            <stop offset="1" stopColor="var(--sd-mars)" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <rect x="0" y={y(k.survivable_km)} width="320" height={150 - y(k.survivable_km)} fill="url(#alt-atm)" />
        <path d="M0 150 Q160 140 320 150 V170 H0 Z" fill="var(--sd-mars-dark)" />
        <line x1="10" x2="310" y1={y(k.planned_km)} y2={y(k.planned_km)} stroke="var(--sd-crt-hi)" strokeWidth="3" />
        <text x="14" y={y(k.planned_km) - 6} className="alt-label ok">
          {W.plan(`${f.num(k.planned_km)} km`)}
        </text>
        <line x1="10" x2="310" y1={y(k.survivable_km)} y2={y(k.survivable_km)} stroke="var(--sd-amber)" strokeWidth="2" strokeDasharray="6 4" />
        <text x="14" y={y(k.survivable_km) - 6} className="alt-label warn">
          {W.safe(`${f.num(k.survivable_km)} km`)}
        </text>
        <line x1="10" x2="310" y1={y(k.estimated_km)} y2={y(k.estimated_km)} stroke="var(--sd-alarm)" strokeWidth="3" />
        <text x="306" y={y(k.estimated_km) + 16} textAnchor="end" className="alt-label bad">
          {W.happened(`${f.num(k.estimated_km)} km`)}
        </text>
      </svg>
      <p className="faint solved-note">
        {W.note.plan} <SourceInfo s={fx.plannedPeriapsis_km} title={W.noteTitle.plan} />
        {W.note.safe} <SourceInfo s={fx.survivableMinPeriapsis_km} title={W.noteTitle.safe} />
        {W.note.estimate} <SourceInfo s={fx.estimatedPeriapsis_km} title={W.noteTitle.estimate} />
      </p>
      <button type="button" className="btn-big" onClick={onBack}>
        {W.backToList}
      </button>
    </div>
  );
}
