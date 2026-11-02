// A PHONE CONTROLLER in the online room (design: Signal Delay - Online Room.dc.html, screens T6c–f; room states T7b
// waiting, T7c signal lost, T7d host left; spec: Online room). The phone shows only its own role's switches and
// follows the host's stage: the waiting room, the objective vote, packing its role's parts, the flight (the danger
// card's turn, and the role's own panel: the Flight Director's final call, the Engineer's gauges, the Science Lead's
// targets, Comms & Ops' DSN pass and queue), then the report. The phone rebuilds the mission from the room's log and
// flies it on to the host's clock (useRoomPhone); every number comes from the engine (team/controller.ts and the
// console's views). Words in sdWords (CONTROLLER_WORDS), with the team words it shares with the shared screen.
import { useMemo, useState } from 'react';
import { consoleView } from '../../engine/ops/console';
import { FLY_RULES, flyTiles } from '../../engine/ops/fly';
import { scienceTargetsView } from '../../engine/ops/scienceView';
import { packBlockers, PACK, type PartId } from '../../engine/pack';
import { cardTurn, commsView, directorView } from '../../engine/team/controller';
import { teamSpend } from '../../engine/team/negotiate';
import { mySeat } from '../../engine/team/online';
import { objectiveAutoAgrees, type TeamState } from '../../engine/team/reduce';
import { replayTeam, type TeamSession } from '../../engine/team/replay';
import { teamReport } from '../../engine/team/report';
import { partRole, ROLE_IDS, TEAM_RULES, type RoleId, type SeatId } from '../../engine/team/roles';
import { objectiveCards, objectiveVote } from '../../engine/team/setup';
import { SharedLimits } from '../components/team/TeamPanels';
import { TeamDebrief } from '../components/team/TeamDebrief';
import { LangToggle } from '../components/sd/LangToggle';
import { SDIcon } from '../components/sd/SDIcon';
import { SoundToggle } from '../components/sd/SoundToggle';
import * as f from '../format';
import { useLaunchPlan } from '../launchPlan';
import type { RoomPhone } from '../online/useRoom';
import { CONTROLLER_WORDS as W, FLY_WORDS, JOIN_WORDS, OBJECTIVE_WORDS, optionShort, PART_LOOK, QUICK_WORDS, ROLE_WORDS, TEAM_FLY_WORDS, TEAM_WORDS, targetName } from '../sdWords';
import { JoinOffline } from './OnlineJoin';

interface Props {
  phone: RoomPhone;
  onHome: () => void;
  onLocal: () => void;
  /** CHANGE ROLE (in the waiting room): back to the join screen. */
  onChangeRole: () => void;
}

/** How long a bounce (SLOW DOWN, not your role) stays on screen. */
const BOUNCE_MS = 3000;

const letter = (i: number) => TEAM_FLY_WORDS.letters[i] ?? String(i + 1);

/** The role band at the top (design: "YOU ARE · CHLO / SCIENCE LEAD"). */
function RoleBand({ roles, sign, dim }: { roles: RoleId[]; sign: string; dim?: boolean }) {
  const main = roles[0] ?? 'flight-director';
  return (
    <div className={`ol-band tm-r-${main}${dim ? ' is-dim' : ''}`}>
      <span className="ol-band-tile">
        <SDIcon icon={ROLE_WORDS[main].icon} size={24} color="var(--role)" />
      </span>
      <span className="ol-band-text">
        <span className="ol-band-kicker">{W.youAre(sign)}</span>
        <span className="ol-band-name">{roles.length ? TEAM_WORDS.join(roles.map((r) => (roles.length > 1 ? ROLE_WORDS[r].ab : ROLE_WORDS[r].name))) : W.open}</span>
      </span>
    </div>
  );
}

/** The preset messages (no free text) and the last one heard. */
function Quick({ state, role, act }: { state: TeamState; role: RoleId; act: RoomPhone['act'] }) {
  const lastSay = state.feed[state.feed.length - 1];
  const who = lastSay ? state.team?.seats.find((s) => s.id === lastSay.seat) : undefined;
  return (
    <>
      <div className="ol-quick" role="group" aria-label={W.speaking}>
        {TEAM_RULES.quick.value.map((q) => (
          <button key={q} type="button" className="ol-quick-key" onClick={() => act(role, { kind: 'say', quick: q })}>
            {QUICK_WORDS[q] ?? q}
          </button>
        ))}
      </div>
      <span className="ol-last">{lastSay && who ? W.last(ROLE_WORDS[who.roles[0] ?? 'flight-director'].ab, QUICK_WORDS[lastSay.quick] ?? lastSay.quick) : W.noLast}</span>
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

function Waiting({ phone, seat, onChangeRole, onLeave }: { phone: RoomPhone; seat: SeatId; onChangeRole: () => void; onLeave: () => void }) {
  const room = phone.state!.room!;
  const bySeat = (r: RoleId) => room.seats.find((s) => s.role === r);
  const open = ROLE_IDS.filter((r) => !bySeat(r));
  const line = !bySeat('flight-director') ? W.waitingNoFd : open.length ? W.openRoles(TEAM_WORDS.join(open.map((r) => ROLE_WORDS[r].ab))) : W.allIn;
  return (
    <>
      <div className="ol-row-head">
        <span className="tm-label">{W.crew(f.num(room.seats.filter((s) => s.role).length), f.num(ROLE_IDS.length))}</span>
        <span className="tm-label">{W.hostBig}</span>
      </div>
      <div className="ol-crew">
        {ROLE_IDS.map((r) => {
          const s = bySeat(r);
          return (
            <div key={r} className={`ol-crew-row tm-r-${r}${s ? ' is-in' : ''}`}>
              <span className="ol-crew-tile">
                <SDIcon icon={ROLE_WORDS[r].icon} size={22} color={s ? 'var(--sd-paper-ink)' : 'var(--sd-ink-6)'} />
              </span>
              <span className="ol-crew-name">{ROLE_WORDS[r].short}</span>
              <span className="ol-crew-who">{s ? (s.seat === seat ? W.meTag(s.callSign) : s.callSign) : W.open}</span>
            </div>
          );
        })}
      </div>
      <div className="ol-well sd-well">
        <span className="ol-well-big">{W.waiting}</span>
        <span className="ol-well-line">{line}</span>
      </div>
      <span className="ol-note">{W.keepOpen}</span>
      <div className="ol-two">
        <button type="button" className="ol-key ol-key-dark" onClick={onChangeRole}>
          {W.changeRole}
        </button>
        <button type="button" className="ol-key ol-key-ghost" onClick={onLeave}>
          {W.leave}
        </button>
      </div>
    </>
  );
}

function ObjectivePanel({ s, roles, act }: { s: TeamState; roles: RoleId[]; act: RoomPhone['act'] }) {
  const v = objectiveVote(s);
  const team = s.team!;
  const fd = roles.includes('flight-director');
  const msg =
    v.next === 'pick'
      ? OBJECTIVE_WORDS.msgPick
      : v.next === 'wait'
        ? OBJECTIVE_WORDS.msgWait(f.num(v.waiting), v.waiting === 1)
        : v.next === 'overrule'
          ? OBJECTIVE_WORDS.msgObject(TEAM_WORDS.join(v.objectors.map((r) => ROLE_WORDS[r].ab)), v.objectors.length === 1)
          : v.next === 'lock'
            ? OBJECTIVE_WORDS.msgAll
            : OBJECTIVE_WORDS.msgLocked(OBJECTIVE_WORDS.objectives[s.objective!].title);
  const cards = objectiveCards(s.base);
  const voters = roles.filter((r) => r !== 'flight-director' && !objectiveAutoAgrees(team, r));
  return (
    <>
      <span className="tm-label">{fd ? W.pickObjective : W.fdPicks(team.seats.find((x) => x.roles.includes('flight-director'))?.callSign ?? '')}</span>
      <div className="ol-objs">
        {cards.map((c) => {
          const w = OBJECTIVE_WORDS.objectives[c.id];
          return (
            <button key={c.id} type="button" className="ol-obj" aria-pressed={s.objective === c.id} disabled={!fd || !!s.objectiveLocked} onClick={() => act('flight-director', { kind: 'objective', objective: c.id })}>
              <span className="ol-obj-title">{w.title}</span>
              <span className="ol-obj-line">{w.line}</span>
            </button>
          );
        })}
      </div>
      {voters.map((r) => {
        const voice = s.objectiveVoices[r];
        const say = (x: 'agree' | 'object') => act(r, { kind: 'objective-voice', voice: voice === x ? 'none' : x });
        return (
          <div key={r} className={`ol-voice tm-r-${r}`}>
            <span className="tm-label">{ROLE_WORDS[r].name}</span>
            <div className="ol-two">
              <button type="button" className="ol-key ol-key-go" aria-pressed={voice === 'agree'} disabled={!s.objective || !!s.objectiveLocked} onClick={() => say('agree')}>
                {OBJECTIVE_WORDS.agree}
              </button>
              <button type="button" className="ol-key ol-key-stop" aria-pressed={voice === 'object'} disabled={!s.objective || !!s.objectiveLocked} onClick={() => say('object')}>
                {OBJECTIVE_WORDS.object}
              </button>
            </div>
          </div>
        );
      })}
      <div className="ol-well sd-well">
        <span className="ol-well-line">{msg}</span>
      </div>
      {fd && !s.objectiveLocked && (
        <button type="button" className="ol-big-key" disabled={v.next !== 'lock' && v.next !== 'overrule'} onClick={() => act('flight-director', { kind: 'objective-lock' })}>
          {v.next === 'overrule' ? OBJECTIVE_WORDS.overrule : v.next === 'lock' ? OBJECTIVE_WORDS.lock : OBJECTIVE_WORDS.waiting}
        </button>
      )}
    </>
  );
}

function PackPanel({ s, roles, act }: { s: TeamState; roles: RoleId[]; act: RoomPhone['act'] }) {
  const plan = useLaunchPlan(s.base, s.packed);
  const ev = plan.ev;
  const blockers = useMemo(() => packBlockers(s.packed, ev, { base: s.base, shelf: s.shelf }), [s.packed, ev, s.base, s.shelf]);
  const spend = teamSpend(s, ev);
  const mine = s.shelf.filter((id) => roles.includes(partRole(id)) && !PACK.parts[id].locked);
  const packed = new Set(s.packed.map((q) => q.id));
  const fd = roles.includes('flight-director');
  const ready = plan.day !== undefined && plan.q !== undefined && plan.q.quality !== 'bad' && blockers.length === 0;
  return (
    <>
      <SharedLimits spend={spend} compact />
      <span className="tm-label">{W.yourParts}</span>
      <div className="ol-parts">
        {mine.map((id: PartId) => {
          const on = packed.has(id);
          return (
            <button key={id} type="button" className="ol-part" aria-pressed={on} onClick={() => act(partRole(id), { kind: on ? 'unpack' : 'pack', part: id })}>
              <SDIcon icon={PART_LOOK[id].icon} size={22} color={on ? 'var(--sd-paper-ink)' : 'var(--sd-crt-hi)'} />
              <span className="ol-part-name">{PART_LOOK[id].name}</span>
              <span className="ol-part-tag">{on ? W.packedTag : W.addTag}</span>
            </button>
          );
        })}
      </div>
      {fd ? (
        <button type="button" className="ol-big-key" disabled={!ready} onClick={() => plan.day && act('flight-director', { kind: 'launch', day: plan.day })}>
          {ready ? W.launch : W.blocked}
        </button>
      ) : (
        <div className="ol-well sd-well">
          <span className="ol-well-line">{W.launchWait}</span>
        </div>
      )}
    </>
  );
}

function FlyPanel({ at, seat, roles, act }: { at: TeamSession; seat: SeatId; roles: RoleId[]; act: RoomPhone['act'] }) {
  const s = at.team;
  const ops = at.ops!;
  const [pick, setPick] = useState<string>();
  const turn = cardTurn(s, ops, seat);
  const alert = consoleView(ops).alert;
  const optLabel = (id: string, label: string) => (alert ? optionShort(alert.type, id, label) : label);
  const options = alert?.options ?? [];
  const pickLine = (id?: string) => {
    const i = options.findIndex((o) => o.id === id);
    return i >= 0 ? TEAM_FLY_WORDS.pick(letter(i), optLabel(options[i]!.id, options[i]!.label)) : '';
  };
  const seatAb = (x: SeatId) => {
    const r = s.team?.seats.find((y) => y.id === x)?.roles ?? [];
    return r.length ? ROLE_WORDS[r[0]!].ab : '';
  };
  // The Flight Director may call before every vote is in (decision 90), but the strip still says who is voting.
  const early = turn?.action === 'call' && turn.vote.stage === 'vote';
  const mine = turn && !early && (turn.action === 'recommend' || turn.action === 'vote' || turn.action === 'call');
  const turnText = !turn
    ? W.calm
    : mine
      ? W.turnMine[turn.action as 'recommend' | 'vote' | 'call']
      : turn.action === 'done'
        ? W.turnDone(pickLine(turn.vote.result?.optionId))
        : W.turnWait(TEAM_WORDS.join(turn.waitingOn.map((r) => ROLE_WORDS[r].ab)));
  const recRole = turn?.vote.recommender.role;
  const myVoteRole = roles.find((r) => r !== 'flight-director') ?? roles[0] ?? 'flight-director';
  const send = (kind: 'recommend' | 'vote' | 'call', optionId: string) => turn && act(kind === 'recommend' ? recRole! : kind === 'call' ? 'flight-director' : myVoteRole, { kind, decisionId: turn.decisionId, optionId });

  const strip = (
    <div className={`ol-turn${mine ? ' is-mine' : ''}`}>
      <span className="ol-turn-text">{turnText}</span>
      <span className="ol-dots" aria-hidden="true">
        {(turn?.dots ?? ROLE_IDS.map((role) => ({ role, on: false }))).map((d) => (
          <span key={d.role} className={`ol-dot tm-r-${d.role}${d.on ? ' is-on' : ''}`} />
        ))}
      </span>
    </div>
  );

  const card = turn && alert && (
    <div className="ol-card">
      <span className="ol-card-head">{W.danger(FLY_WORDS.hazard(alert.type, alert.title))}</span>
      <span className={`ol-card-rec tm-r-${recRole}`}>
        <span className="ol-card-dot" aria-hidden="true" />
        {turn.vote.recommend ? W.recBy(ROLE_WORDS[recRole!].name, pickLine(turn.vote.recommend)) : W.waitRec(ROLE_WORDS[recRole!].name)}
      </span>
    </div>
  );

  /** A choice key: recommend, vote, or the Flight Director's pick before FINAL CALL. */
  const choices = (kind: 'recommend' | 'vote') => (
    <div className="ol-choices">
      {options.map((o, i) => {
        const on = turn?.mine === o.id;
        return (
          <button key={o.id} type="button" className="ol-choice" aria-pressed={on} disabled={turn?.action !== kind || !o.affordable || alert!.blockedByConjunction} onClick={() => send(kind, o.id)}>
            <span className="ol-choice-k">{letter(i)}</span>
            <span className="ol-choice-label">{optLabel(o.id, o.label)}</span>
            <span className="ol-choice-tag">{on ? W.votedTag : W.voteTag}</span>
          </button>
        );
      })}
    </div>
  );

  const fdPanel = turn && roles.includes('flight-director') && turn.action !== 'recommend' && (
    <>
      <span className="tm-label">{W.teamVotes}</span>
      <div className="ol-tally">
        {options.map((o, i) => {
          const tokens = turn.vote.voters.filter((v) => v.voice === o.id).map((v) => v.seat);
          return (
            <button key={o.id} type="button" className="ol-tally-row" aria-pressed={pick === o.id} disabled={turn.action !== 'call'} onClick={() => setPick(o.id)}>
              <span className="ol-choice-k">{letter(i)}</span>
              <span className="ol-choice-label">{optLabel(o.id, o.label)}</span>
              <span className="ol-tokens">
                {tokens.map((x) => (
                  <span key={x} className={`ol-token tm-r-${s.team?.seats.find((y) => y.id === x)?.roles[0] ?? 'flight-director'}`}>
                    {seatAb(x)}
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <button type="button" className="ol-final" disabled={turn.action !== 'call' || !pick} onClick={() => pick && send('call', pick)}>
        <span className="ol-final-big">{W.finalCall}</span>
        <span className="ol-final-sub">{pick ? (turn.vote.leans && turn.vote.leans !== pick ? W.finalOverrule(pickLine(pick)) : W.finalSend(pickLine(pick))) : W.finalPick}</span>
      </button>
    </>
  );

  const d = directorView(ops);
  const fdTiles = roles.includes('flight-director') && (
    <div className="ol-tiles">
      <div className="ol-tile">
        <span className="ol-tile-k">{W.objective}</span>
        <span className="ol-tile-v">{s.objective ? OBJECTIVE_WORDS.objectives[s.objective].title : W.notSet}</span>
      </div>
      <div className="ol-tile">
        <span className="ol-tile-k">{W.ends}</span>
        <span className="ol-tile-v is-crt">{FLY_WORDS.duration(d.endsIn_s)}</span>
      </div>
    </div>
  );

  const tiles = flyTiles(ops);
  const engPanel = roles.includes('spacecraft-engineer') && (
    <>
      <span className="tm-label">{W.gauges}</span>
      <div className="ol-gauges">
        {(['power', 'fuel', 'data', 'systems'] as const).map((k) => (
          <div key={k} className={`ol-gauge is-${tiles[k].status}`}>
            <span className="ol-gauge-n">{W.gauge[k]}</span>
            <span className="ol-segs" aria-label={`${W.gauge[k]}: ${f.num(tiles[k].segments)}/${f.num(FLY_RULES.gaugeSegments.value)}`}>
              {Array.from({ length: FLY_RULES.gaugeSegments.value }, (_, i) => (
                <span key={i} className={`ol-seg${i < tiles[k].segments ? ' is-on' : ''}`} />
              ))}
            </span>
          </div>
        ))}
      </div>
    </>
  );

  const sci = scienceTargetsView(ops);
  const sciPanel = roles.includes('science-lead') && (
    <>
      <span className="tm-label">{W.targets}</span>
      {sci.available ? (
        <div className="ol-targets">
          {sci.cards.map((c) => (
            <div key={c.id} className="ol-target">
              <span className="ol-target-name">{targetName(c.id)}</span>
              <span className="ol-target-st">{W.targetState[c.state] ?? c.state}</span>
              <button type="button" className="ol-key ol-key-amber" disabled={c.state !== 'ready' || c.blocker !== undefined} onClick={() => act('science-lead', { kind: 'ops', op: { kind: 'command', command: { kind: 'observe', targetId: c.id } } })}>
                {W.observe}
              </button>
            </div>
          ))}
        </div>
      ) : (
        <span className="ol-note">{W.targetsLater}</span>
      )}
    </>
  );

  const com = commsView(ops);
  const comPanel = roles.includes('comms-ops') && (
    <>
      <div className="ol-comms sd-well">
        <span className="ol-comms-cell">
          <span className="ol-comms-k">{W.nextPass}</span>
          <span className="ol-comms-v">{com.passIn_s === undefined ? W.noPass : com.passIn_s <= 0 ? W.passNow : FLY_WORDS.duration(com.passIn_s)}</span>
        </span>
        <span className="ol-comms-cell">
          <span className="ol-comms-k">{W.lightTime}</span>
          <span className="ol-comms-v is-amber">{f.lightTime(com.oneWay_s)}</span>
        </span>
      </div>
      <span className="tm-label">{W.queue}</span>
      <div className="ol-queue">
        {com.queue.length === 0 && <span className="ol-note">{W.queueEmpty}</span>}
        {com.queue.map((c, i) => (
          <div key={c.id} className="ol-queue-row">
            <span className="ol-queue-n">{f.num(i + 1)}</span>
            <span className="ol-queue-t">{c.kind === 'respond' && c.hazardId && c.optionId ? pickLine(c.optionId) || W.queueKinds.respond : (W.queueKinds[c.kind] ?? c.kind)}</span>
            <span className="ol-queue-st">{FLY_WORDS.duration(c.timeLeft_s)}</span>
          </div>
        ))}
      </div>
      {com.book && (
        <button
          type="button"
          className="ol-key ol-key-dark"
          disabled={com.book.booked}
          onClick={() => act('comms-ops', { kind: 'ops', op: { kind: 'dsn', fromDay: com.book!.day, toDay: com.book!.day, booking: { dish: com.book!.dish, hours: com.book!.hours } } })}
        >
          {com.book.booked ? W.booked : W.book(FLY_WORDS.day(f.num(com.book.day)))}
        </button>
      )}
    </>
  );

  const voteKind = turn?.action === 'recommend' ? 'recommend' : 'vote';
  const showChoices = turn && (turn.action === 'recommend' || turn.action === 'vote' || (turn.action === 'wait' && !roles.includes('flight-director')) || (turn.action === 'done' && !roles.includes('flight-director')));
  return (
    <>
      {strip}
      {fdTiles}
      {card ?? (
        <div className="ol-well sd-well">
          <span className="ol-well-big">{W.calm}</span>
          <span className="ol-well-line">{W.calmLine}</span>
        </div>
      )}
      {fdPanel}
      {showChoices && (
        <>
          <span className="tm-label">{voteKind === 'recommend' ? W.yourRec : W.yourVote}</span>
          {choices(voteKind)}
        </>
      )}
      {engPanel}
      {sciPanel}
      {comPanel}
    </>
  );
}

function Report({ phone }: { phone: RoomPhone }) {
  const m = phone.state?.mission;
  const log = phone.client?.log() ?? [];
  const done = useMemo(() => (m ? replayTeam(m.base, m.shelf, { seed: m.seed }, log) : undefined), [m, log.length]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!done) return null;
  const report = teamReport(log, { team: done.team, ...(done.ops ? { ops: done.ops } : {}) });
  return (
    <>
      <div className="ol-well sd-well">
        <span className="ol-well-line">{W.report}</span>
      </div>
      <TeamDebrief report={report} state={done.team} phone onNext={() => undefined} />
    </>
  );
}

// ---------------------------------------------------------------------------------------------------------------

export function Controller({ phone, onHome, onLocal, onChangeRole }: Props) {
  const st = phone.state;
  const room = st?.room;
  const me = st?.me;
  const [copied, setCopied] = useState(false);
  const sess = phone.at ?? phone.session;
  const team = sess?.team.team;
  const seatRoles = me ? (team?.seats.find((x) => x.id === me.seat)?.roles ?? (mySeat(st!)?.role ? [mySeat(st!)!.role!] : [])) : [];
  const roles = ROLE_IDS.filter((r) => seatRoles.includes(r));
  const stage = room?.stage ?? 'lobby';
  const status = st?.status ?? 'connecting';
  const bounce = st?.bounced && Date.now() - st.bounced.at < BOUNCE_MS ? (W.bounce[st.bounced.reason] ?? W.bounced) : undefined;
  const day = sess?.ops && sess.team.launched ? W.day(f.dayPad(directorView(sess.ops).day)) : undefined;
  const right = status === 'lost' ? W.noSignal : status === 'closed' ? W.roomClosed : (day ?? W.linked);

  const leave = () => {
    phone.leave();
    onHome();
  };

  let body;
  if (status === 'offline' || (!st && phone.why)) body = <JoinOffline phone={phone} onLocal={onLocal} />;
  else if (status === 'refused') body = <span className="ol-note">{st?.refused === 'protocol' ? JOIN_WORDS.protocol : JOIN_WORDS.full}</span>;
  else if (status === 'closed') {
    const why = st?.closed === 'expired' ? W.expired : st?.closed === 'ended' ? W.ended : W.hostLeft;
    body = (
      <>
        <div className="ol-ended">
          <span className="ol-ended-k">{day ?? ''}</span>
          <span className="ol-ended-title">{why}</span>
          <span className="ol-ended-body">{W.hostLeftBody}</span>
          <span className="ol-ended-stamp">{W.roomEnded}</span>
        </div>
        <div className="ol-well sd-well is-center">
          <span className="ol-crt-kicker">{W.resumeCode}</span>
          <span className="ol-resume-code">{room?.resume ?? ''}</span>
          <span className="ol-well-line">{W.resumeHow(room?.code ?? st?.code ?? '')}</span>
        </div>
        <div className="ol-saved">
          <span className="ol-saved-row">
            <span className="tm-label">{W.savedStage}</span>
            <span className="ol-saved-v">{W.stages[stage] ?? stage}</span>
          </span>
          <span className="ol-saved-row">
            <span className="tm-label">{W.savedRole}</span>
            <span className={`ol-saved-v tm-r-${roles[0] ?? 'flight-director'}`}>{roles.map((r) => ROLE_WORDS[r].name).join(' + ')}</span>
          </span>
        </div>
        <div className="ol-stack">
          <button
            type="button"
            className="ol-key ol-key-amber"
            onClick={() => {
              void navigator.clipboard?.writeText(room?.resume ?? '').catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? W.copied : W.copy}
          </button>
          <button type="button" className="ol-key ol-key-ghost" onClick={leave}>
            {W.backHome}
          </button>
        </div>
      </>
    );
  } else if (status === 'lost')
    body = (
      <>
        <div className="ol-well ol-lost sd-well is-center">
          <span className="ol-lost-big">{W.lost}</span>
          <span className="ol-well-line">{W.reconnectTry(f.num(phone.retry.tries + 1))}</span>
        </div>
        <span className="ol-note">{W.lostBody}</span>
        <span className="tm-label">{W.teamSees}</span>
        <div className="ol-sees">{W.teamSeesLine(me?.callSign ?? '')}</div>
        <div className="ol-stack">
          <button type="button" className="ol-key ol-key-amber" onClick={phone.retryNow}>
            {W.retryNow}
          </button>
        </div>
      </>
    );
  else if (!me || !room) body = <span className="ol-note">{JOIN_WORDS.searching}</span>;
  else if (stage === 'lobby' || !sess?.team.team) body = <Waiting phone={phone} seat={me.seat} onChangeRole={onChangeRole} onLeave={leave} />;
  else if (stage === 'objective') body = <ObjectivePanel s={sess.team} roles={roles} act={phone.act} />;
  else if (stage === 'pack' || !sess.ops) body = <PackPanel s={sess.team} roles={roles} act={phone.act} />;
  else if (stage === 'fly') body = <FlyPanel at={sess} seat={me.seat} roles={roles} act={phone.act} />;
  else body = <Report phone={phone} />;

  const playing = status === 'linked' && sess?.team.team && stage !== 'lobby' && stage !== 'report';
  return (
    <div className={`tm ol ol-phone ol-ctl${status === 'closed' ? ' is-closed' : ''}`}>
      <div className="ol-phone-frame">
        <header className="ol-phone-top">
          <span className={`ol-top-code${status === 'closed' ? ' is-struck' : ''}`}>{room?.code ?? st?.code ?? ''}</span>
          <span className={`ol-top-st is-${status}`}>{right}</span>
          <span className="sd-top-keys">
            <LangToggle />
            <SoundToggle />
          </span>
        </header>
        {me && <RoleBand roles={roles} sign={me.callSign} dim={status === 'lost'} />}
        {bounce && (
          <span className="ol-bounce" role="status">
            {bounce}
          </span>
        )}
        <main className="ol-ctl-body">{body}</main>
        {playing && sess && <Quick state={sess.team} role={roles[0] ?? 'flight-director'} act={phone.act} />}
      </div>
    </div>
  );
}
