// TRANSMISSIONS (Fly & Survive design: TELETYPE 02 · ‹NAME› ⇄ EARTH). The robot's messages in black, your orders in
// red, each printed only once it has reached Earth (engine transmissionFeed): a robot line says how long it took,
// an order says where it is on its trip. Desktop: a paper column beside the CRT, newest at the bottom. Phone: the
// latest line on a strip; tap it for the log. Words in sdWords (TX_WORDS, robotSays).
// Team mode (design T4): the team's quick messages and its votes on danger cards print in between, in time order
// (engine team/fly.ts withTeamLines), each marked with the role that sent it.
import { useState, type ReactNode } from 'react';
import type { FeedEntry, OrderLine, TransmissionFeed } from '../../../engine/ops/index';
import { withTeamLines, type TeamTxLine, type TxRow } from '../../../engine/team/fly';
import * as f from '../../format';
import { FLY_WORDS, QUICK_WORDS, ROLE_WORDS, robotSays, TEAM_FLY_WORDS, targetName, TX_WORDS, type VoiceContext } from '../../sdWords';
import { useTeletype } from '../sd/Teletype';

/** The phone log shows this many of the newest lines. */
export const TX_PHONE_LINES = 8;

interface Props {
  feed: TransmissionFeed;
  voice: VoiceContext;
  /** The light time now (s): how old everything on the teletype is. */
  oneWay_s: number;
  phone: boolean;
  /** Highlight this robot line (the reply on screen). */
  hot?: FeedEntry;
  /** Replaces the paper's footer (desktop): the DOWNLINK key once pictures are ordered. */
  footer?: ReactNode;
  /** Team mode: the team's lines in flight. */
  team?: TeamTxLine[];
}

function orderWhat(o: OrderLine, voice: VoiceContext): string {
  if (o.kind === 'power-plan') return TX_WORDS.plan;
  if (o.kind === 'standing-orders') return TX_WORDS.standing;
  if (o.kind === 'observe') return TX_WORDS.observe(targetName(o.targetId ?? ''));
  if (o.kind === 'extension') return TX_WORDS.extend(FLY_WORDS.years(o.years ?? 0));
  return o.hazardType && o.optionId && voice.option ? voice.option(o.hazardType, o.optionId) : (o.optionId ?? '').toUpperCase();
}

function orderStamp(o: OrderLine): string {
  switch (o.status) {
    case 'queued':
      return TX_WORDS.queued(f.mmss(o.departsIn_s ?? 0));
    case 'in-flight':
      return TX_WORDS.inFlight(f.mmss(o.arrivesIn_s ?? 0));
    case 'reply-inbound':
      return TX_WORDS.replyInbound;
    case 'too-late':
      return TX_WORDS.tooLate;
    default:
      return TX_WORDS.delivered;
  }
}

/** One line as the teletype prints it: who and when, the stamp, the text. */
export function txLine(e: FeedEntry, voice: VoiceContext) {
  if (e.from === 'robot') {
    const m = e.message!;
    return {
      who: voice.name.toUpperCase(),
      stamp: `${e.roundTrip_s !== undefined ? `${TX_WORDS.reply} · ` : ''}${m.delay_s < 1 ? TX_WORDS.noDelay : TX_WORDS.took(FLY_WORDS.duration(m.delay_s))}`,
      text: robotSays(m, voice),
    };
  }
  const o = e.order!;
  return { who: TX_WORDS.fromEarth(voice.name.toUpperCase()), stamp: orderStamp(o), text: `▸ ${TX_WORDS.order(orderWhat(o, voice))}` };
}

const keyOf = (e: TxRow) => (e.from === 'team' ? `team:${e.seq}` : `${e.from}:${e.at}:${e.message?.kind ?? e.order?.kind}:${e.message?.seq ?? e.order?.targetId ?? e.order?.hazardId ?? ''}`);

/** A team line's words: the quick message, or the step of the vote with the option's name. */
export function teamText(l: TeamTxLine, voice: VoiceContext): string {
  const w = l.what;
  if (w.kind === 'say') return QUICK_WORDS[w.quick] ?? w.quick;
  const opt = w.hazardType && voice.option ? voice.option(w.hazardType, w.optionId) : w.optionId.toUpperCase();
  return TEAM_FLY_WORDS.line[w.kind](opt);
}

function TeamRow({ l, voice }: { l: TeamTxLine; voice: VoiceContext }) {
  return (
    <li className="tx-line team">
      <span className="tx-meta">
        <span>
          {TX_WORDS.day(f.dayPad(l.at))} <span className={`tx-role tm-r-${l.role}`}>{ROLE_WORDS[l.role].ab}</span>
        </span>
      </span>
      <span className="tx-text">{teamText(l, voice)}</span>
    </li>
  );
}

function Line({ e, voice, typing, hot }: { e: FeedEntry; voice: VoiceContext; typing: boolean; hot: boolean }) {
  const l = txLine(e, voice);
  const shown = useTeletype(typing ? l.text : '');
  return (
    <li className={`tx-line ${e.from}${hot ? ' hot' : ''}`}>
      <span className="tx-meta">
        <span>
          {l.who} · {TX_WORDS.day(f.dayPad(e.at))}
        </span>
        <span className="tx-stamp">{l.stamp}</span>
      </span>
      <span className="tx-text">
        {typing ? (
          <>
            <span className="sr-only">{l.text}</span>
            <span aria-hidden="true">
              {shown}
              <span className="sd-cursor">█</span>
            </span>
          </>
        ) : (
          l.text
        )}
      </span>
    </li>
  );
}

export function Transmissions({ feed, voice, oneWay_s, phone, hot, footer, team }: Props) {
  const [open, setOpen] = useState(false);
  const entries: TxRow[] = team ? withTeamLines(feed.entries, team) : feed.entries;
  const latest = entries[entries.length - 1];
  const name = voice.name.toUpperCase();
  const isHot = (e: TxRow) => hot !== undefined && keyOf(e) === keyOf(hot);
  const list = (rows: TxRow[]) => (
    <ol className="tx-list" role="log" aria-label={TX_WORDS.logLabel}>
      {[...rows].reverse().map((e, i) =>
        e.from === 'team' ? <TeamRow key={keyOf(e)} l={e} voice={voice} /> : <Line key={keyOf(e)} e={e} voice={voice} typing={i === 0} hot={isHot(e)} />,
      )}
      {rows.length === 0 && <li className="tx-empty">{TX_WORDS.empty}</li>}
    </ol>
  );

  if (phone) {
    const l = latest && (latest.from === 'team' ? { who: ROLE_WORDS[latest.role].ab, stamp: TEAM_FLY_WORDS.team, text: teamText(latest, voice) } : txLine(latest, voice));
    return (
      <>
        <button type="button" className={`tx-strip${latest && isHot(latest) ? ' hot' : ''}`} aria-expanded={open} aria-label={TX_WORDS.logLabel} onClick={() => setOpen((o) => !o)}>
          <span className="tx-strip-body">
            {l ? (
              <>
                <span className={`tx-strip-meta ${latest!.from}`}>
                  {l.who} · {TX_WORDS.day(f.dayPad(latest!.at))} · {l.stamp}
                </span>
                <span className={`tx-strip-text ${latest!.from}`}>{l.text}</span>
              </>
            ) : (
              <span className="tx-strip-text">{TX_WORDS.empty}</span>
            )}
          </span>
          <span className="tx-strip-chev">{open ? TX_WORDS.close : TX_WORDS.log}</span>
        </button>
        {open && <div className="tx-sheet">{list(entries.slice(-TX_PHONE_LINES))}</div>}
      </>
    );
  }

  return (
    <section className="tx" aria-label={TX_WORDS.title}>
      <header className="tx-head">
        <span className="tx-head-l">
          <span className="tx-kicker">{TX_WORDS.kicker(name)}</span>
          <span className="tx-title">{TX_WORDS.title}</span>
        </span>
        <span className="tx-key">
          <span className="robot">{TX_WORDS.keyRobot(name)}</span>
          <span className="earth">{TX_WORDS.keyYou}</span>
        </span>
      </header>
      {list(entries)}
      {footer ?? (
        <footer className="tx-foot">
          {TX_WORDS.footBefore(name)}
          <b>{TX_WORDS.footAge(FLY_WORDS.duration(oneWay_s))}</b>
          {TX_WORDS.footAfter}
        </footer>
      )}
    </section>
  );
}
