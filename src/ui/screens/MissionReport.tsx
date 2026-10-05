// MISSION REPORT (Signal Delay design, screen 03). The teletype prints your mission as a 4-panel comic. Then: stars,
// what saved you, what hurt you, how the real NASA mission did, and a real lesson from the flight. Engineer mode adds
// the score breakdown, every comparison row with its ⓘ, the star rules and the Mission operations risk.
// Every number comes from the engine (operationsDebrief, ops/report.ts, compare.ts); this screen lays them out.
import { useEffect, useMemo, useState } from 'react';
import { DESTINATIONS, HAZARDS, LAUNCH_VEHICLES, RIDESHARES } from '../../engine/data';
import { heardMessages, operationsDebrief, VOICE_RULES, type OpsState } from '../../engine/ops/index';
import { reportCompare, reportPanels, reportVerdict } from '../../engine/ops/report';
import { MAX_SCORE, MARGIN_BAND, scoreGrade, STAR_RULES } from '../../engine/scoring';
import type { CompareMetric } from '../../engine/compare';
import type { Design } from '../../engine/types';
import { ComicArt } from '../components/report/ComicArt';
import { PostcardView, postcardSrc } from '../components/sd/PostcardView';
import { POSTCARDS, postcardsEarned } from '../../engine/postcards';
import { SourceInfo } from '../components/SourceInfo';
import { MissionSteps } from '../components/sd/MissionSteps';
import { BackButton } from '../components/sd/BackButton';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { useReducedMotion } from '../opsGeometry';
import { useOpsRisk } from '../riskRunner';
import { useIsPhone } from '../sdGeometry';
import {
  CATEGORY_NAME,
  dangerLook,
  GAME_NAME,
  hurtWords,
  optionShort,
  PANEL_SOUND,
  panelWords,
  REPORT_STAMP,
  POSTCARD_WORDS,
  ROBOT_WORDS,
  robotNameOr,
  robotSays,
  savedWords,
  STAR_WORDS,
} from '../sdWords';
import * as f from '../format';

/** The comic prints one panel every 2.4 s, its caption at 38 characters a second (as the design). */
export const PANEL_STEP_MS = 2400;
const CAPTION_CPS = 38;
const TICK_MS = 40;

const METRIC: Record<CompareMetric, string> = {
  wetMass: 'LAUNCH MASS',
  dryMass: 'DRY MASS',
  propellant: 'PROPELLANT',
  powerAtArrival: 'POWER AT ARRIVAL',
  deltaVCapability: 'Δv CAPABILITY',
};
const metricValue = (m: CompareMetric, v: number) => (m === 'powerAtArrival' ? f.watts(v) : m === 'deltaVCapability' ? f.speed(v) : f.kg(v));
const DEST_COLOR: Record<Design['destination'], string> = { moon: '#cfcabb', venus: '#e8c27a', mars: 'var(--sd-mars)', bennu: '#8f8676', jupiter: '#d9a066' };

interface Props {
  state: OpsState;
  design: Design;
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  /** Next level, when this flight opened it (Cadet). */
  next?: { title: string; onPlay: () => void };
  /** The first Notebook lesson this flight earned (NEW CARD). */
  newCard?: { num: number; total: number; title: string; body: string; onOpen: () => void };
  onFlyAgain: () => void;
  onHome: () => void;
  /** ◂ BACK to the screen before the flight. */
  onBack?: () => void;
  homeLabel: string;
  /** The robot's name (Pack); the default when empty. */
  robotName?: string;
}

export function MissionReport({ state, design, mode, onMode, missionName, next, newCard, onFlyAgain, onHome, onBack, homeLabel, robotName }: Props) {
  const engineer = mode === 'engineer';
  const phone = useIsPhone();
  const still = useReducedMotion();
  const dest = DESTINATIONS[design.destination];
  const ev = state.env.ev;
  const d = useMemo(() => operationsDebrief(state), [state]);
  const panels = useMemo(() => reportPanels(state), [state]);
  const verdict = useMemo(() => reportVerdict(state), [state]);
  const compare = useMemo(() => reportCompare(design, ev), [design, ev]);
  const risk = useOpsRisk(design);
  const [t, setT] = useState(0);

  useEffect(() => {
    if (still || t > PANEL_STEP_MS * panels.length + 2000) return;
    const id = setTimeout(() => setT((x) => x + TICK_MS), TICK_MS);
    return () => clearTimeout(id);
  }, [t, still, panels.length]);

  const type = (h: string) => HAZARDS[h]?.title ?? h;
  const label = (h: string, o: string) => optionShort(h, o, HAZARDS[h]?.options.find((x) => x.id === o)?.label ?? o);
  const rocket = design.rideshareId ? RIDESHARES[design.rideshareId]?.name ?? design.launchVehicleId : LAUNCH_VEHICLES[design.launchVehicleId]?.name ?? design.launchVehicleId;
  const ctx = { dest: dest.name, rocket, label, title: type, autopilot: !!design.kit?.autopilot, sent_Gbit: d.downlinked_Gbit };
  const stampKey = state.status === 'lost' ? 'lost' : state.status === 'not-launched' ? 'not-launched' : 'complete';
  const stamp = REPORT_STAMP[stampKey];
  const saved = savedWords(verdict.saved, { label, title: type });
  const hurt = hurtWords(verdict.hurt, { label, title: type });
  const starWords = STAR_WORDS(dest.name);
  const starRule = [
    `${f.num(STAR_RULES.phasesToReachScience.value)} phases done`,
    `science ≥ ${f.num(STAR_RULES.scienceForSecondStar.value)}`,
    `margins ${f.pct(MARGIN_BAND.low.value, 0)}–${f.pct(MARGIN_BAND.high.value, 0)}`,
  ];
  const lessonHazard = verdict.hurt.code === 'bad-outcome' ? verdict.hurt.hazardType : 'hazardType' in verdict.saved ? verdict.saved.hazardType : panels.find((p) => p.hazardType)?.hazardType;
  const lesson = lessonHazard ? HAZARDS[lessonHazard]?.realHistory : undefined;

  const panelEls = panels.map((p, i) => {
    const lt = still ? Infinity : t - i * PANEL_STEP_MS;
    const on = lt > 0;
    const w = panelWords(p, ctx);
    const text = on ? w.text.slice(0, Math.floor((lt / 1000) * CAPTION_CPS)) : '';
    const eng =
      p.kind === 'launch'
        ? `${f.isoDate(ev.details.launchDate)} · C3 ${f.c3(ev.trajectory.c3)}`
        : p.kind === 'arrival' && p.dv_ms !== undefined
          ? `Δv ${f.speed(p.dv_ms)}`
          : p.kind === 'conjunction'
            ? `SEP < 2° · ${f.days(p.blackoutDays ?? 0)}`
            : p.kind === 'hazard'
              ? `${p.by ?? ''} · ${p.bad ? 'failed' : 'ok'}`
              : p.kind === 'complete'
                ? `${f.gbit(d.downlinked_Gbit)} of ${f.gbit(d.goal_Gbit)}`
                : '';
    return (
      <figure key={i} className={`rp-panel${on ? ' on' : ''}`} aria-label={`${w.head}: ${w.text}`}>
        <ComicArt kind={p.kind} {...(p.hazardType && PANEL_SOUND[p.hazardType] ? { sound: PANEL_SOUND[p.hazardType] } : {})} destColor={DEST_COLOR[design.destination]} />
        <div className="rp-halftone" />
        <figcaption className="rp-caption">
          <span className="rp-cap-head">{w.head}</span>
          <span className="rp-cap-text">{text}</span>
        </figcaption>
        {engineer && eng && <span className="rp-panel-eng">{eng}</span>}
      </figure>
    );
  });

  const starsEl = (
    <div className="rp-stars" aria-label={`${f.num(d.stars)} of 3 stars`}>
      {starWords.map((s, i) => (
        <div key={s} className="rp-star">
          <SDIcon icon="star" size={phone ? 34 : 44} color={i < d.stars ? 'var(--sd-gold)' : 'var(--sd-ink-3)'} fill={i < d.stars} sw={1.6} />
          <span className="rp-star-word">{s}</span>
          {engineer && !phone && <span className="rp-star-rule">{starRule[i]}</span>}
        </div>
      ))}
    </div>
  );

  const stampEl = (
    <div className="rp-stamp" style={{ color: stamp.color, borderColor: stamp.color }}>
      {stamp.word[0]}
      <br />
      {stamp.word[1]}
    </div>
  );

  const verdictEl = (
    <div className="rp-verdicts">
      <div className="rp-verdict">
        <span className="rp-verdict-icon ok">
          <SDIcon icon={verdict.saved.code === 'part' || verdict.saved.code === 'autopilot' ? 'shield' : 'check'} size={24} color="var(--sd-paper)" />
        </span>
        <div>
          <span className="rp-verdict-k ok">WHAT SAVED YOU</span>
          <span className="rp-verdict-v">
            <b>{saved.strong}</b>
            {saved.rest}
          </span>
        </div>
      </div>
      <div className="rp-verdict">
        <span className="rp-verdict-icon bad">
          <SDIcon icon="storm" size={24} color="var(--sd-paper)" />
        </span>
        <div>
          <span className="rp-verdict-k bad">WHAT HURT YOU</span>
          <span className="rp-verdict-v">
            <b>{hurt.strong}</b>
            {hurt.rest}
          </span>
        </div>
      </div>
    </div>
  );

  const rows = compare
    ? [
        { k: 'LAUNCH', you: f.isoDate(compare.launch.you).toUpperCase(), them: f.isoDate(compare.launch.them.value).toUpperCase(), s: compare.launch.them as unknown as Parameters<typeof SourceInfo>[0]['s'], gap: false },
        ...(compare.scienceDays.them
          ? [{ k: 'PLANNED SCIENCE', you: f.days(compare.scienceDays.you).toUpperCase(), them: f.days(compare.scienceDays.them!.value).toUpperCase(), s: compare.scienceDays.them!, gap: false }]
          : []),
        ...compare.rows
          .filter((r) => engineer || r.metric === 'wetMass' || r.metric === 'powerAtArrival')
          .map((r) => ({ k: METRIC[r.metric], you: metricValue(r.metric, r.you), them: metricValue(r.metric, r.them), s: r.themSource, gap: r.metric === compare.biggestGap })),
      ]
    : [];

  const compareEl = compare && (
    <div className="rp-compare">
      <div className="rp-compare-head">
        <span className="rp-compare-title">YOU vs THE REAL ONE</span>
        <span className="rp-compare-label">{compare.label.toUpperCase()}</span>
      </div>
      <div className="rp-compare-grid" role="table" aria-label="You vs the real mission">
        <span role="columnheader" />
        <span role="columnheader" className="you">
          YOU
        </span>
        <span role="columnheader" className="them">
          {compare.missionId === 'maven' ? 'MAVEN' : 'OSIRIS-REX'}
        </span>
        {rows.map((r) => (
          <div key={r.k} role="row" className={`rp-row${r.gap && engineer ? ' gap' : ''}`}>
            <span role="rowheader" className="k">
              {r.k}
            </span>
            <span role="cell" className="you">
              {r.you}
            </span>
            <span role="cell" className="them">
              {r.them}
              {engineer && <SourceInfo s={r.s} title={`${compare.label} ${r.k.toLowerCase()}`} />}
            </span>
          </div>
        ))}
      </div>
      {engineer && <span className="rp-compare-src">BIGGEST GAP · {METRIC[compare.biggestGap]} · HISTORY · {compare.history}</span>}
    </div>
  );

  const lessonEl = (
    <div className="rp-card-col">
      {newCard && (
        <div className="rp-card">
          <span className="rp-card-tag">NEW CARD</span>
          <span className="rp-card-k">
            ENGINEER’S NOTEBOOK · {String(newCard.num).padStart(2, '0')} / {String(newCard.total).padStart(2, '0')}
          </span>
          <span className="rp-card-title">{newCard.title}</span>
          <span className="rp-card-v">{newCard.body}</span>
        </div>
      )}
      {!newCard && lesson && (
        <div className="rp-card">
          <span className="rp-card-tag">REAL LESSON</span>
          <span className="rp-card-k">
            FROM THIS FLIGHT
            {lesson.isGameEstimate && <span className="sd-verify">TO VERIFY</span>}
            <SourceInfo s={lesson} title="the lesson" />
          </span>
          <span className="rp-card-title">{lessonHazard ? dangerLook(lessonHazard, HAZARDS[lessonHazard]?.title ?? '').title : ''}</span>
          <span className="rp-card-v">{lesson.value}</span>
        </div>
      )}
      <div className="rp-actions">
        {newCard ? (
          <button type="button" className="rp-btn outline" onClick={newCard.onOpen}>
            {phone ? 'NOTEBOOK' : 'OPEN NOTEBOOK'}
          </button>
        ) : next ? (
          <button type="button" className="rp-btn outline" onClick={next.onPlay}>
            NEXT: {next.title.toUpperCase()}
          </button>
        ) : (
          <button type="button" className="rp-btn outline" onClick={onHome}>
            {homeLabel}
          </button>
        )}
        <button type="button" className="rp-btn red" onClick={onFlyAgain}>
          FLY AGAIN
        </button>
      </div>
      {next && newCard && (
        <button type="button" className="rp-link" onClick={next.onPlay}>
          NEXT: {next.title.toUpperCase()}
        </button>
      )}
      <button type="button" className="rp-link" onClick={onHome}>
        {homeLabel}
      </button>
    </div>
  );

  const name = robotNameOr(robotName);
  const last = heardMessages(state).latest;
  const lastEl = last && (
    <div className={`rp-radio${last.kind === 'last-words' || last.kind === 'launch-failed' ? ' bad' : ''}`} role="note" aria-label={ROBOT_WORDS.lastMessage(name)}>
      <span className="rp-radio-k">
        📡 {ROBOT_WORDS.lastMessage(name)}
        {last.kind === 'last-words' && <SourceInfo s={VOICE_RULES.lastWordsHistory} title="Opportunity’s last message" />}
      </span>
      <span className="rp-radio-v">“{robotSays(last, dest.name)}”</span>
      <span className="rp-radio-t">{ROBOT_WORDS.took(dest.name.toUpperCase(), f.durationWords(last.delay_s))}</span>
    </div>
  );

  const won = useMemo(() => postcardsEarned(state).map((id) => POSTCARDS.find((c) => c.id === id)!), [state]);
  const [card, setCard] = useState<string>();
  const openCard = won.find((c) => c.id === card);
  const cardsEl = state.status !== 'not-launched' && (
    <section className="rp-postcards" aria-label={POSTCARD_WORDS.report}>
      <span className="rp-postcards-k">📮 {POSTCARD_WORDS.report}</span>
      {won.length ? (
        <div className="rp-postcards-row">
          {won.map((c) => (
            <button key={c.id} type="button" className="rp-postcard" onClick={() => setCard(c.id)} aria-label={c.title}>
              <img src={postcardSrc(c)} alt="" />
              <span>{c.title}</span>
            </button>
          ))}
        </div>
      ) : (
        <span className="rp-postcards-none">{POSTCARD_WORDS.none}</span>
      )}
      {openCard && <PostcardView card={openCard} onClose={() => setCard(undefined)} />}
    </section>
  );

  const engineerEl = engineer && (
    <section className="rp-eng" aria-label="Engineer details">
      <div className="rp-eng-col">
        <span className="rp-eng-title">
          SCORE · {f.num(d.score)} / {f.num(MAX_SCORE)} · Σ wᵢ sᵢ
        </span>
        <div className="rp-score" role="table" aria-label="Score breakdown">
          {d.breakdown.map((b) => (
            <div key={b.category} role="row" className={`rp-score-row${b.category === d.hintCategory ? ' hint' : ''}`}>
              <span role="rowheader">{CATEGORY_NAME[b.category]}</span>
              <span role="cell">{f.num(b.score)}</span>
              <span role="cell">× {f.num(b.weight, 2)}</span>
              <span role="cell">= {f.num(b.contribution, 1)}</span>
              <span role="cell" className={`grade ${scoreGrade(b.score)}`}>
                {scoreGrade(b.score).toUpperCase()}
              </span>
            </div>
          ))}
        </div>
        <span className="rp-hint">NEXT STAR · {d.hint}</span>
      </div>
      <div className="rp-eng-col">
        <span className="rp-eng-title">MISSION RISK · OPS MONTE CARLO</span>
        <span className="rp-risk">
          {risk.status !== 'error' && risk.estimate
            ? `${f.pct(risk.estimate.meter.used, 1)} ± ${f.pct(risk.estimate.stdErr, 1)} · ${f.num(risk.estimate.tally.runs)} runs · seed ${String(risk.estimate.seed)}`
            : risk.status === 'error'
              ? risk.error
              : 'Simulating…'}
        </span>
        <span className="rp-eng-title">FLIGHT</span>
        <span className="rp-risk">
          {`${f.num(d.scienceDaysAchieved)} of ${f.num(d.plannedScienceDays)} science days · ${f.gbit(d.downlinked_Gbit)} of ${f.gbit(d.goal_Gbit)} · Δv left ${f.speed(d.deltaV.left_ms)}`}
        </span>
        <span className="rp-risk">{`Seed ${String(state.seed ?? 0)} · extension: ${d.extension.outcome}`}</span>
      </div>
    </section>
  );

  if (phone)
    return (
      <div className={`sd rp phone${engineer ? ' eng' : ''}`}>
        <div className="rp-sheet">
          {onBack && <BackButton onBack={onBack} className="rp-back" />}
          <div className="rp-phone-head">
            <div>
              <span className="rp-kicker">
                {missionName.toUpperCase()} · DAY {f.num(panels.at(-1)!.day)}
              </span>
              <h1 className="rp-title">
                MISSION
                <br />
                REPORT
              </h1>
            </div>
            {stampEl}
          </div>
          <ModeLever mode={mode} onMode={onMode} />
          {starsEl}
          <div className="rp-strip">{panelEls}</div>
          {lastEl}
          {cardsEl}
          {verdictEl}
          {compareEl}
          {lessonEl}
          {engineerEl}
        </div>
      </div>
    );

  return (
    <div className={`sd rp${engineer ? ' eng' : ''}`}>
      <div className="rp-sheet">
        <div className="rp-holes left" />
        <div className="rp-holes right" />
        <header className="rp-head">
          <div className="rp-head-l">
            {onBack && <BackButton onBack={onBack} className="rp-back" />}
            <span className="rp-kicker">
              TELETYPE · {missionName.toUpperCase()} · {dest.name.toUpperCase()} · DAY 000–{f.dayPad(panels.at(-1)!.day)}
            </span>
            <h1 className="rp-title">MISSION REPORT</h1>
          </div>
          {starsEl}
          {stampEl}
        </header>
        <div className="rp-comic">{panelEls}</div>
        {lastEl}
        {cardsEl}
        <div className="rp-lower">
          {verdictEl}
          {compareEl ?? <div className="rp-compare empty">NO REAL MISSION TO COMPARE WITH YET</div>}
          {lessonEl}
        </div>
        {engineerEl}
        <div className="rp-nav">
          <button type="button" className="rp-brand" onClick={onHome} aria-label="Signal Delay: home">
            {GAME_NAME}
          </button>
          <MissionSteps at={2} first={engineer ? 'BUILD' : 'PACK'} />
          <ModeLever mode={mode} onMode={onMode} />
        </div>
      </div>
    </div>
  );
}
