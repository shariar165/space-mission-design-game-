// PACK (Signal Delay design, screen 02; spec UI rules, Pack). The rocket nose is a backpack: every part takes
// squares, and weight is a separate limit on the scale beside it. The Danger Deck shows what is coming, so you pack
// for it, then arm and launch on the best day (or change it on the Launch Day step; Engineer always goes there). Every number comes from the engine (pack.ts,
// evaluateDesign, cadetGauges); this screen only lays them out.
// Team mode (design: Signal Delay - Team Play.dc.html, T3): with `team`, every packing is a team log entry made as the
// part's role, the shelf is grouped by role, the nose parts wear their role's colour, and SHARED LIMITS, the conflict
// banner, the TEAM LINE and the quick messages join the screen (components/team/TeamPanels). The Flight Director launches.
import { useMemo, useState } from 'react';
import { cadetGauges } from '../../engine/cadet';
import { DESTINATIONS, HAZARDS, LESSONS } from '../../engine/data';
import {
  coversOf,
  dangerDeck,
  fitPart,
  footprint,
  initialPack,
  noseSquares,
  onDay,
  PACK,
  packBlockers,
  packPart,
  partsCovering,
  unpackPart,
  type Packed,
  type PartId,
} from '../../engine/pack';
import type { Design } from '../../engine/types';
import type { ObjectiveId } from '../../engine/objectives';
import type { TeamAct, TeamAction } from '../../engine/team/log';
import { teamSpend } from '../../engine/team/negotiate';
import type { TeamState } from '../../engine/team/reduce';
import { partRole, ROLE_IDS, type RoleId } from '../../engine/team/roles';
import { ConflictBanner, CrewChips, QuickBar, SharedLimits, TeamLine } from '../components/team/TeamPanels';
import { TeamSteps } from './TeamSetup';
import { SourceInfo } from '../components/SourceInfo';
import { BackButton } from '../components/sd/BackButton';
import { MissionBriefing } from '../components/sd/MissionBriefing';
import { NameTag } from '../components/sd/NameTag';
import { MissionSteps } from '../components/sd/MissionSteps';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { LangToggle } from '../components/sd/LangToggle';
import { SoundToggle } from '../components/sd/SoundToggle';
import { SDIcon } from '../components/sd/SDIcon';
import { useLaunchPlan } from '../launchPlan';
import { useIsPhone } from '../sdGeometry';
import {
  BRAND_WORDS,
  DAY_WORDS,
  dangerLook,
  fuelFixWords,
  deckWhen,
  GAME_NAME,
  LAUNCH_CHECKS,
  LAUNCH_DAY_WORDS,
  NAV,
  PACK_WORDS,
  PACK_BLOCKER,
  PART_LOOK,
  SCIENCE_PARTS,
  shortDate,
  STAMP,
  OBJECTIVE_WORDS,
  ROLE_WORDS,
  TEAM_PACK_WORDS,
  WEIGHT_WORDS,
  type Briefing,
} from '../sdWords';
import * as f from '../format';
import { said } from '../cited';

interface Props {
  base: Design;
  shelf: PartId[];
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  /** The level teaches that no packing can reach the target (Jupiter): the lesson card gives the star. */
  impossible?: boolean;
  onLesson?: () => void;
  onHome: () => void;
  onLaunch: (d: Design) => void;
  /** ◂ BACK to the previous screen. */
  onBack?: () => void;
  /** The mission briefing behind MISSION INFO; `open` shows it at once (the first visit to a level). */
  brief?: { title: string; briefing: Briefing; concept?: string; open?: boolean };
  /** The briefing was closed. */
  onBriefSeen?: () => void;
  /** The robot's name (empty: the default) and its setter. */
  robotName?: string;
  onRobotName?: (name: string) => void;
  /** The packing so far (kept by App while the player visits the Launch Day step), and its setter. */
  packed?: Packed;
  onPacked?: (p: Packed) => void;
  /** The player's launch day (calendar index); none: the best day. */
  pick?: number;
  /** Open the Launch Day step (CHANGE ▸). */
  onDays?: () => void;
  /** Team mode: packing goes through the team's log. */
  team?: PackTeam;
}

type Hl = { dangers: string[]; parts: PartId[] } | undefined;

/** Team mode: the team's state and log, and how to act as a role (useTeam). */
export interface PackTeam {
  state: TeamState;
  log: readonly TeamAction[];
  send: (role: RoleId, act: TeamAct) => void;
  objective?: ObjectiveId;
}

export function Pack({ base, shelf, mode, onMode, missionName, impossible, onLesson, onHome, onLaunch, onBack, brief, onBriefSeen, robotName, onRobotName, packed: kept, onPacked, pick, onDays, team }: Props) {
  const engineer = mode === 'engineer';
  const phone = useIsPhone();
  const dest = DESTINATIONS[base.destination];
  const [soloPacked, setPackedRaw] = useState<Packed>(() => kept ?? initialPack(base, shelf));
  /** The packing: the team's (its log decides) or this player's own. */
  const packed = team ? team.state.packed : soloPacked;
  const setPacked = (p: Packed) => {
    setPackedRaw(p);
    onPacked?.(p);
  };
  /** Team mode: the role whose voice the quick messages carry. */
  const [speaker, setSpeaker] = useState<RoleId>('flight-director');
  const [hl, setHl] = useState<Hl>();
  const [armed, setArmed] = useState(false);
  const [noRoom, setNoRoom] = useState<PartId>();
  const [briefOpen, setBriefOpen] = useState(!!brief?.open);

  // The launch day: the best one (engine bestLaunchDay) unless the player picked one on the Launch Day step.
  const plan = useLaunchPlan(base, packed, pick);
  const { days, day, design, ev, q } = plan;
  // "No fuel" says which shelf part fixes it (the engine tries it: Moon 3's trim burns need the extra tank).
  const blockers = useMemo(() => packBlockers(packed, ev, { base: plan.day ? onDay(base, plan.day) : base, shelf }), [packed, ev, base, plan.day, shelf]);
  const deck = dangerDeck(base.destination, packed);
  const sq = noseSquares(packed);
  const weight = cadetGauges(ev).weight;
  const packedIds = new Set(packed.map((p) => p.id));
  const tray = shelf.filter((id) => !packedIds.has(id) && id !== 'computer' && id !== 'engine');
  const trayFits = tray.map((id) => ({ id, fits: fitPart(packed, id) !== undefined }));
  const full = trayFits.length > 0 && !trayFits.some((t) => t.fits);
  const ready = armed && q !== undefined && q.quality !== 'bad' && blockers.length === 0;
  const lessonCard = impossible && blockers.some((b) => b.code === 'too-heavy') ? LESSONS[base.destination] : undefined;

  const add = (id: PartId) => {
    const next = packPart(packed, id);
    // a team's refused packing still goes on the log: it raises the space conflict the report counts
    if (team) team.send(partRole(id), { kind: 'pack', part: id });
    if (!next) return setNoRoom(id);
    setNoRoom(undefined);
    if (!team) setPacked(next);
  };
  const remove = (id: PartId) => {
    setNoRoom(undefined);
    if (team) team.send(partRole(id), { kind: 'unpack', part: id });
    else setPacked(unpackPart(packed, id));
  };
  const spend = team ? teamSpend(team.state, ev) : undefined;
  const ownerOf = (id: PartId): RoleId => team?.state.owners[id] ?? partRole(id);
  const go = () => {
    if (team && plan.day) team.send('flight-director', { kind: 'launch', day: plan.day });
    onLaunch(design);
  };
  const lit = (id: PartId) => !!hl?.parts.includes(id);
  const hoverPart = (id: PartId) => setHl({ dangers: coversOf(id), parts: [id] });
  const hoverDanger = (id: string) => setHl({ dangers: [id], parts: partsCovering(shelf, id) });

  const badges = (id: PartId) => [
    ...coversOf(id)
      .filter((d) => deck.some((c) => c.id === d))
      .map((d) => ({ icon: dangerLook(d, HAZARDS[d]?.title ?? d).icon, color: 'var(--sd-coral)', title: PACK_WORDS.covers(dangerLook(d, HAZARDS[d]?.title ?? d).title) })),
    ...(SCIENCE_PARTS.includes(id) ? [{ icon: 'star' as const, color: 'var(--sd-crt-hi)', title: PACK_WORDS.earnsData }] : []),
  ];

  const spaceText = full ? PACK_WORDS.full : sq.free === 0 ? PACK_WORDS.fullShort : PACK_WORDS.left(f.num(sq.free));
  const spaceHot = full || sq.free === 0;
  const status = noRoom ? PACK_WORDS.noRoom : blockers[0] ? PACK_BLOCKER[blockers[0].code] : undefined;
  const fix = !noRoom ? blockers.find((b) => b.fix)?.fix : undefined;

  const nose = (
    <div className="pk-nose" aria-label={PACK_WORDS.noseLabel}>
      <div className="pk-cone">{!phone && <span>{PACK_WORDS.nose}</span>}</div>
      <div className="pk-hull">
        <div className="pk-grid" role="group" aria-label={PACK_WORDS.noseState(spaceText)}>
          {Array.from({ length: sq.total }, (_, i) => (
            <span key={`c${i}`} className="pk-cell" style={{ gridColumn: `${(i % PACK.grid.cols.value) + 1}`, gridRow: `${Math.floor(i / PACK.grid.cols.value) + 1}` }} />
          ))}
          {packed.map((p) => {
            const fp = footprint(p.id);
            const look = PART_LOOK[p.id];
            const locked = p.id === 'computer' || p.id === 'engine';
            return (
              <button
                key={p.id}
                type="button"
                className={`pk-part${lit(p.id) ? ' lit' : ''}${locked ? ' locked' : ''}${team ? ` tm-r-${ownerOf(p.id)} by-role` : ''}`}
                style={{ gridColumn: `${p.c + 1} / span ${fp.w}`, gridRow: `${p.r + 1} / span ${fp.h}`, ...(team ? {} : { background: look.color }) }}
                title={locked ? PACK_WORDS.alwaysPacked(look.name) : PACK_WORDS.tapToUnpack(look.name)}
                aria-label={locked ? PACK_WORDS.alwaysPackedLabel(look.name) : PACK_WORDS.unpack(look.name)}
                onClick={() => !locked && remove(p.id)}
                onMouseEnter={() => hoverPart(p.id)}
                onMouseLeave={() => setHl(undefined)}
              >
                <SDIcon icon={look.icon} size={phone ? 18 : 22} color="var(--sd-paper-ink)" />
                {fp.squares > 1 && !phone && <span className="pk-part-name">{look.short}</span>}
                <span className="pk-part-badges">
                  {locked && !phone && <SDIcon icon="lock" size={13} color="var(--sd-paper-ink)" />}
                  {badges(p.id).map((b, i) => (
                    <span key={i} className="pk-badge-dot" title={b.title}>
                      <SDIcon icon={b.icon} size={phone ? 9 : 12} color={b.color} />
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="pk-base" />
    </div>
  );

  const scale = (
    <div className={`pk-scale ${weight.status}`} role="meter" aria-label={PACK_WORDS.weightLabel} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.min(1.5, weight.ratio)}>
      <span className="pk-scale-k">{PACK_WORDS.weight}</span>
      <div className="pk-scale-tube sd-well">
        <div className="pk-scale-fill" style={{ height: `${Math.min(100, weight.ratio * 100)}%` }} />
        <div className="pk-scale-line" />
      </div>
      <span className="pk-scale-v">{WEIGHT_WORDS[weight.status]}</span>
      {engineer && (
        <span className="pk-scale-eng">
          {f.kg(ev.meters.mass.used)} / {f.kg(ev.meters.mass.limit)}
        </span>
      )}
    </div>
  );

  const trayCard = ({ id, fits }: { id: PartId; fits: boolean }) => {
        const look = PART_LOOK[id];
        const fp = footprint(id);
        return (
          <button
            key={id}
            type="button"
            className={`pk-tray-card${fits ? '' : ' nofit'}${lit(id) ? ' lit' : ''}`}
            aria-label={PACK_WORDS.pack(look.name, fits)}
            onClick={() => add(id)}
            onMouseEnter={() => hoverPart(id)}
            onMouseLeave={() => setHl(undefined)}
          >
            <span className="pk-mini-well">
              <span className="pk-mini" style={{ gridTemplateColumns: `repeat(${fp.w}, var(--mini))`, gridTemplateRows: `repeat(${fp.h}, var(--mini))` }}>
                {Array.from({ length: fp.squares }, (_, i) => (
                  <span key={i} style={{ background: look.color }} />
                ))}
              </span>
            </span>
            <span className="pk-tray-body">
              <span className="pk-tray-name">{look.name}</span>
              <span className={`pk-tray-state${fits ? '' : ' no'}`}>{phone ? (fits ? PACK_WORDS.fitsShort(f.num(fp.squares)) : PACK_WORDS.noRoomShort) : fits ? PACK_WORDS.fits(f.num(fp.squares)) : PACK_WORDS.wontFit}</span>
              {engineer && !phone && <span className="pk-tray-eng">{`${f.num(fp.w)}×${f.num(fp.h)}`}</span>}
            </span>
            <span className="pk-tray-badges">
              {badges(id).map((b, i) => (
                <span key={i} className="pk-badge-ring" title={b.title} style={{ borderColor: b.color }}>
                  <SDIcon icon={b.icon} size={phone ? 12 : 14} color={b.color} />
                </span>
              ))}
            </span>
          </button>
        );
  };
  const shelfCards = (
    <div className="pk-tray-list">
      {team
        ? ROLE_IDS.map((r) => {
            const mine = trayFits.filter((t) => partRole(t.id) === r);
            const sp = spend!.roles[r];
            return (
              <div key={r} className={`tp-group tm-r-${r}`} role="group" aria-label={ROLE_WORDS[r].name}>
                <div className="tp-group-head">
                  <span className="tp-group-name">
                    <SDIcon icon={ROLE_WORDS[r].icon} size={15} color="var(--role)" />
                    {phone ? ROLE_WORDS[r].short : ROLE_WORDS[r].name}
                  </span>
                  <span className="tp-group-spend">{TEAM_PACK_WORDS.roleSpend(f.money(sp.cost_M), f.kg(sp.mass_kg))}</span>
                </div>
                {mine.map(trayCard)}
              </div>
            );
          })
        : trayFits.map(trayCard)}
      {tray.length === 0 && <div className="pk-empty">{PACK_WORDS.shelfEmpty}</div>}
    </div>
  );

  const deckList = (
    <div className="pk-deck-list" role="list" aria-label={PACK_WORDS.deck}>
      {deck.map((c) => {
        const look = dangerLook(c.id, HAZARDS[c.id]?.title ?? c.id);
        const st = STAMP[c.stamp];
        return (
          <div
            key={c.id}
            role="listitem"
            aria-label={`${look.title}: ${st.word}`}
            className={`pk-danger${hl?.dangers.includes(c.id) ? ' lit' : ''}`}
            onMouseEnter={() => hoverDanger(c.id)}
            onMouseLeave={() => setHl(undefined)}
          >
            <span className="pk-danger-icon">
              <SDIcon icon={look.icon} size={phone ? 19 : 28} color="var(--sd-paper)" />
            </span>
            {phone ? (
              <span className="pk-danger-short">{look.short}</span>
            ) : (
              <span className="pk-danger-body">
                <span className="pk-danger-title">{look.title}</span>
                <span className="pk-danger-line">{look.line}</span>
                <span className="pk-danger-when">
                  {deckWhen(c)}
                  {engineer && c.kind === 'hazard' && HAZARDS[c.id] && <SourceInfo s={HAZARDS[c.id]!.realHistory} title={look.title.toLowerCase()} />}
                </span>
              </span>
            )}
            <span className="pk-stamp" style={{ color: st.color, borderColor: st.color }}>
              {phone ? st.short : st.word}
            </span>
          </div>
        );
      })}
    </div>
  );

  // The launch day in one line: the day it flies and how good it is; CHANGE ▸ opens the Launch Day step.
  const calendar = (
    <div className="pk-cal pk-dayline">
      <span className="sd-label">{LAUNCH_DAY_WORDS.line}</span>
      <span className={`pk-cal-msg ${q?.quality ?? ''}`}>
        {!days || !day || !q
          ? LAUNCH_DAY_WORDS.working
          : `${shortDate(day.date)} · ${engineer && day.c3 !== undefined ? `C3 = ${f.c3(day.c3)}` : phone ? DAY_WORDS[q.quality].short : DAY_WORDS[q.quality].msg(dest.name)}`}
      </span>
      {days && <span className="pk-dayline-who">{plan.auto ? LAUNCH_DAY_WORDS.auto : LAUNCH_DAY_WORDS.yours}</span>}
      {onDays && (
        <button type="button" className="sd-ghost-btn pk-change" onClick={onDays} disabled={!days}>
          {LAUNCH_DAY_WORDS.change}
        </button>
      )}
    </div>
  );

  // The launch checklist: each step ticks itself off; the first one still to do is lit, so a greyed LAUNCH explains itself.
  const checks = [
    { id: 'packed', text: LAUNCH_CHECKS.packed, done: blockers.length === 0 },
    { id: 'day', text: LAUNCH_CHECKS.day, done: q !== undefined && q.quality !== 'bad' },
    { id: 'arm', text: LAUNCH_CHECKS.arm, done: armed },
    { id: 'go', text: LAUNCH_CHECKS.go, done: false },
  ];
  const todo = checks.find((c) => !c.done)?.id;
  const checklist = (
    <ol className="pk-checks" aria-label={PACK_WORDS.checklist}>
      {checks.map((c) => (
        <li key={c.id} className={`${c.done ? 'done' : ''}${todo === c.id ? ' todo' : ''}`} aria-checked={c.done} role="checkbox" aria-disabled="true">
          <span className="pk-check-box">{c.done && <SDIcon icon="check" size={12} color="var(--sd-crt-hi)" />}</span>
          {c.text}
        </li>
      ))}
    </ol>
  );

  const closeBrief = () => {
    setBriefOpen(false);
    onBriefSeen?.();
  };
  const briefing = briefOpen && brief && (
    <MissionBriefing title={brief.title} destination={base.destination} briefing={brief.briefing} {...(brief.concept ? { concept: brief.concept } : {})} onClose={closeBrief} />
  );
  const infoKey = brief && (
    <button type="button" className="sd-ghost-btn pk-info" onClick={() => setBriefOpen(true)}>
      {NAV.info}
    </button>
  );

  const launch = (
    <div className="pk-launch">
      <button type="button" className={`pk-arm${armed ? ' on' : ''}`} role="switch" aria-checked={armed} aria-label={PACK_WORDS.armLabel} onClick={() => setArmed((a) => !a)}>
        <span className="pk-arm-slot">
          <span className="pk-arm-knob" />
        </span>
        <span className="pk-arm-word">{PACK_WORDS.arm}</span>
      </button>
      <button type="button" className={`pk-go${ready ? ' ready' : ''}`} disabled={!ready} onClick={go}>
        {PACK_WORDS.launch}
      </button>
    </div>
  );

  const statusLine = (
    <div className="pk-status sd-well" role="status">
      <span className={`pk-space${spaceHot ? ' hot' : ''}`}>{spaceText}</span>
      {status && <span className="pk-block">· {status}</span>}
      {fix && <span className="pk-fix">{fuelFixWords(fix)}</span>}
      {engineer && !phone && blockers[0]?.engine && <span className="pk-block-eng">{blockers[0].engine}</span>}
    </div>
  );

  const nameTag = onRobotName && <NameTag name={robotName ?? ''} onName={onRobotName} />;

  const lesson = lessonCard && (
    <div className="pk-lesson sd-paper">
      <span className="sd-history-k">
        {PACK_WORDS.lesson(said(lessonCard.title))}
        <SourceInfo s={lessonCard.lesson} title={PACK_WORDS.lessonTitle} />
      </span>
      <span className="sd-history-v">{said(lessonCard.lesson.value)}</span>
      {onLesson && (
        <button type="button" className="sd-cta red" onClick={onLesson}>
          {PACK_WORDS.lessonLearned}
        </button>
      )}
    </div>
  );

  // ---- Team mode pieces (T3) ----
  const banner = spend && <ConflictBanner spend={spend} {...(noRoom ? { noRoom: { part: PART_LOOK[noRoom].name, role: partRole(noRoom) } } : {})} />;
  const quick = team && <QuickBar speaker={speaker} onSpeaker={setSpeaker} onSay={(q) => team.send(speaker, { kind: 'say', quick: q })} />;
  const line = team && <TeamLine state={team.state} log={team.log} {...(phone ? { max: 1 } : {})} />;
  const teamKicker = team?.objective ? TEAM_PACK_WORDS.kicker(OBJECTIVE_WORDS.objectives[team.objective].title) : TEAM_PACK_WORDS.kickerNone;

  if (phone)
    return (
      <div className={`sd pk phone${engineer ? ' eng' : ''}${team ? ' team' : ''}`}>
        <div className="fly-status">
          {onBack ? (
            <BackButton onBack={onBack} />
          ) : (
            <button type="button" className="fly-status-brand" onClick={onHome}>
              {PACK_WORDS.step}
            </button>
          )}
          {infoKey}
          <span className="sd-top-keys">
            <LangToggle />
            <SoundToggle />
            <ModeLever mode={mode} onMode={onMode} />
          </span>
        </div>
        {team ? (
          <>
            <span className="tp-phone-kicker">{teamKicker}</span>
            {banner}
            {spend && <SharedLimits spend={spend} compact />}
          </>
        ) : (
          <div className="pk-deck-phone">
            <span className="sd-label">{PACK_WORDS.deckOf(dest.name)}</span>
            {deckList}
          </div>
        )}
        <div className="pk-nose-row">
          {nose}
          {scale}
        </div>
        {statusLine}
        {nameTag}
        {lesson}
        {shelfCards}
        {calendar}
        {quick}
        {line}
        {checklist}
        {launch}
        {briefing}
      </div>
    );

  return (
    <div className={`sd pk${engineer ? ' eng' : ''}${team ? ' team' : ''}`}>
      <header className="pk-top">
        <div className="pk-top-left">
          {onBack && <BackButton onBack={onBack} />}
          <div className="sd-brand">
          <button type="button" className="sd-brand-name" onClick={onHome} aria-label={BRAND_WORDS.home}>
            {GAME_NAME}
          </button>
          <span className="sd-brand-sub">{team ? teamKicker : BRAND_WORDS.sub(missionName, dest.name)}</span>
          </div>
        </div>
        {team ? <TeamSteps at={1} /> : <MissionSteps at={0} />}
        <div className="pk-top-right">
          {team?.state.team ? <CrewChips team={team.state.team} /> : infoKey}
          <span className="sd-top-keys">
            <LangToggle />
            <SoundToggle />
            <ModeLever mode={mode} onMode={onMode} />
          </span>
        </div>
      </header>
      <div className="pk-main">
        <section className="pk-panel pk-tray" aria-label={PACK_WORDS.shelfLabel}>
          <div className="pk-panel-head">
            <span className="pk-panel-title">{team ? TEAM_PACK_WORDS.shelf : PACK_WORDS.shelf}</span>
            <span className="sd-label dim">{team ? TEAM_PACK_WORDS.byRole : PACK_WORDS.tapToPack}</span>
          </div>
          {shelfCards}
        </section>
        <section className="pk-fairing" aria-label={PACK_WORDS.fairing}>
          <div className="pk-dots" />
          {banner}
          <div className="pk-nose-row">
            {nose}
            {scale}
          </div>
          <div className="pk-status-row">
            {statusLine}
            {nameTag}
          </div>
          {lesson}
        </section>
        {team && spend ? (
          <div className="tp-side">
            <SharedLimits spend={spend} />
            {line}
            <section className="pk-panel pk-cal-panel">{calendar}</section>
          </div>
        ) : (
          <section className="pk-panel pk-deck" aria-label={PACK_WORDS.deckLabel(dest.name)}>
            <div className="pk-deck-head">
              <span className="pk-panel-title">{PACK_WORDS.deckOf(dest.name)}</span>
              <span className="pk-deck-sub">{PACK_WORDS.deckSub}</span>
            </div>
            {deckList}
          </section>
        )}
      </div>
      <footer className="pk-bottom">
        {team ? quick : <section className="pk-panel pk-cal-panel">{calendar}</section>}
        <section className="pk-panel pk-launch-panel">
          {checklist}
          {launch}
        </section>
      </footer>
      {briefing}
    </div>
  );
}
