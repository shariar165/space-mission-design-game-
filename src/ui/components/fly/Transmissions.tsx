// TRANSMISSIONS (Fly & Survive design: TELETYPE 02 · ‹NAME› ⇄ EARTH). The robot's messages in black, your orders in
// red, each printed only once it has reached Earth (engine transmissionFeed): a robot line says how long it took,
// an order says where it is on its trip. Desktop: a paper column beside the CRT, newest at the bottom. Phone: the
// latest line on a strip; tap it for the log. Words in sdWords (TX_WORDS, robotSays).
import { useState } from 'react';
import type { FeedEntry, OrderLine, TransmissionFeed } from '../../../engine/ops/index';
import * as f from '../../format';
import { robotSays, TX_WORDS, type VoiceContext } from '../../sdWords';
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
}

function orderWhat(o: OrderLine, voice: VoiceContext): string {
  if (o.kind === 'power-plan') return TX_WORDS.plan;
  if (o.kind === 'standing-orders') return TX_WORDS.standing;
  if (o.kind === 'extension') return TX_WORDS.extend(`${f.num(o.years ?? 0)} ${o.years === 1 ? 'YEAR' : 'YEARS'}`);
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
      stamp: `${e.roundTrip_s !== undefined ? `${TX_WORDS.reply} · ` : ''}${m.delay_s < 1 ? TX_WORDS.noDelay : TX_WORDS.took(f.durationWords(m.delay_s))}`,
      text: robotSays(m, voice),
    };
  }
  const o = e.order!;
  return { who: TX_WORDS.fromEarth(voice.name.toUpperCase()), stamp: orderStamp(o), text: `▸ ${TX_WORDS.order(orderWhat(o, voice))}` };
}

const keyOf = (e: FeedEntry) => `${e.from}:${e.at}:${e.message?.kind ?? e.order?.kind}`;

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

export function Transmissions({ feed, voice, oneWay_s, phone, hot }: Props) {
  const [open, setOpen] = useState(false);
  const entries = feed.entries;
  const latest = entries[entries.length - 1];
  const name = voice.name.toUpperCase();
  const isHot = (e: FeedEntry) => hot !== undefined && keyOf(e) === keyOf(hot);
  const list = (rows: FeedEntry[]) => (
    <ol className="tx-list" role="log" aria-label={TX_WORDS.logLabel}>
      {[...rows].reverse().map((e, i) => (
        <Line key={keyOf(e)} e={e} voice={voice} typing={i === 0} hot={isHot(e)} />
      ))}
      {rows.length === 0 && <li className="tx-empty">{TX_WORDS.empty}</li>}
    </ol>
  );

  if (phone) {
    const l = latest && txLine(latest, voice);
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
      <footer className="tx-foot">
        {TX_WORDS.footBefore(name)}
        <b>{TX_WORDS.footAge(f.durationWords(oneWay_s))}</b>
        {TX_WORDS.footAfter}
      </footer>
    </section>
  );
}
