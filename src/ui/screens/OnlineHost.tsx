// ONLINE ROOM · HOST (design: Signal Delay - Online Room.dc.html, screen T6a; room states T7a; spec: Online room).
// The big screen shows the room code and the four role slots; phones join with the code and take a role. START
// MISSION needs a Flight Director; the roles nobody took go to the Flight Director's phone. When the relay cannot be
// reached the screen says so and offers local co-op; RESUME A MISSION brings a room back from its resume code. Every
// count and countdown is the engine's (team/room.ts roomView, retryView); words in sdWords (ONLINE_WORDS).
import { useState } from 'react';
import { ROLE_IDS } from '../../engine/team/roles';
import { cleanResumeCode, validResumeCode, type RoomSlot, type RoomView } from '../../engine/team/room';
import { BackButton } from '../components/sd/BackButton';
import { LangToggle } from '../components/sd/LangToggle';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { SoundToggle } from '../components/sd/SoundToggle';
import * as f from '../format';
import type { RoomHost } from '../online/useRoom';
import { useIsPhone } from '../sdGeometry';
import { GAME_NAME, ONLINE_WORDS, ROLE_WORDS, TEAM_WORDS } from '../sdWords';
import { TeamSteps } from './TeamSetup';

interface Props {
  room: RoomHost;
  mode: Mode;
  onMode: (m: Mode) => void;
  onBack: () => void;
  /** START MISSION (a Flight Director has joined). */
  onStart: () => void;
  /** PLAY LOCAL CO-OP: the same four roles on this one screen. */
  onLocal: () => void;
  /** A room came back from its resume code: go on to where its mission was. */
  onResumed: () => void;
}

/** One role slot on the right (design T6a): its colour bar, icon tile, role name and who holds it. */
function Slot({ slot, offline, onFree }: { slot: RoomSlot; offline: boolean; onFree?: () => void }) {
  const w = ROLE_WORDS[slot.role];
  const on = !offline && slot.status !== 'open';
  const st = offline
    ? ONLINE_WORDS.slotNoRelay
    : slot.status === 'open'
      ? ONLINE_WORDS.slotWaiting
      : slot.status === 'away'
        ? ONLINE_WORDS.slotAway(slot.callSign!, f.mmss(slot.holdLeft_s ?? 0))
        : slot.status === 'handed'
          ? ONLINE_WORDS.slotHanded(slot.callSign!, slot.heldBy!)
          : ONLINE_WORDS.slotJoined(slot.callSign!);
  const body = (
    <>
      <span className="ol-slot-bar" aria-hidden="true" />
      <span className="ol-slot-tile">
        <SDIcon icon={w.icon} size={32} color={on ? 'var(--sd-paper-ink)' : 'var(--sd-ink-6)'} />
      </span>
      <span className="ol-slot-text">
        <span className="ol-slot-name">{w.name}</span>
        <span className="ol-slot-st">{st}</span>
      </span>
    </>
  );
  const cls = `ol-slot tm-r-${slot.role} is-${offline ? 'off' : slot.status}`;
  return onFree ? (
    <button type="button" className={cls} onClick={onFree} title={ONLINE_WORDS.freeSlot(w.name, slot.callSign ?? '')}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** The CRT line under the room (design: "> ALL FOUR ROLES FILLED. READY."). */
function hostMessage(v: RoomView | undefined, room: RoomHost): { text: string; tone: 'ok' | 'warn' | 'bad' } {
  if (room.phase === 'offline')
    return room.why === 'not-set-up' ? { text: ONLINE_WORDS.msgNotSetUp, tone: 'bad' } : { text: ONLINE_WORDS.msgOffline(f.num(room.retry.tries), f.mmss(room.retry.nextIn_s)), tone: 'bad' };
  if (room.phase === 'closed' && v) return { text: ONLINE_WORDS.msgClosed(v.resume), tone: 'warn' };
  if (!v) return { text: ONLINE_WORDS.msgOpening, tone: 'ok' };
  const m = v.message;
  switch (m.kind) {
    case 'need-director':
      return { text: ONLINE_WORDS.msgNeedDirector, tone: 'warn' };
    case 'empty':
      return { text: ONLINE_WORDS.msgEmpty(TEAM_WORDS.join(m.roles.map((r) => ROLE_WORDS[r].ab)), m.director), tone: 'ok' };
    case 'ready':
      return { text: ONLINE_WORDS.msgReady, tone: 'ok' };
    case 'away':
      return { text: ONLINE_WORDS.msgAway(m.callSign, f.mmss(m.holdLeft_s)), tone: 'warn' };
    case 'handed':
      return { text: ONLINE_WORDS.msgHanded(m.heldBy, ROLE_WORDS[m.role].ab, m.callSign), tone: 'warn' };
    default:
      return { text: ONLINE_WORDS.msgRunning, tone: 'ok' };
  }
}

export function OnlineHost({ room, mode, onMode, onBack, onStart, onLocal, onResumed }: Props) {
  const phone = useIsPhone();
  const v = room.view;
  const offline = room.phase === 'offline';
  const [resuming, setResuming] = useState(false);
  const [typed, setTyped] = useState('');
  const [unknown, setUnknown] = useState(false);
  const code = cleanResumeCode(typed);

  const chip = offline
    ? ONLINE_WORDS.chipOffline
    : room.phase === 'closed'
      ? ONLINE_WORDS.chipClosed
      : !v || room.phase === 'opening'
        ? ONLINE_WORDS.chipOpening
        : ONLINE_WORDS.chipOpen(f.num(v.linked), f.num(v.max));
  const msg = resuming ? { text: unknown ? ONLINE_WORDS.msgResumeUnknown : ONLINE_WORDS.msgResume, tone: unknown ? ('bad' as const) : ('ok' as const) } : hostMessage(v, room);
  const note = resuming ? ONLINE_WORDS.noteResume : offline ? ONLINE_WORDS.noteOffline : ONLINE_WORDS.note;

  const resume = () => {
    if (!validResumeCode(code) || !room.resume(code)) return setUnknown(true);
    setResuming(false);
    onResumed();
  };

  let crt;
  if (resuming) {
    crt = (
      <form
        className="ol-crt-body ol-resume"
        onSubmit={(e) => {
          e.preventDefault();
          resume();
        }}
      >
        <span className="ol-crt-kicker">{ONLINE_WORDS.resume}</span>
        <input
          className="ol-resume-input"
          aria-label={ONLINE_WORDS.resumeCode}
          value={typed}
          maxLength={10}
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => {
            setTyped(e.target.value);
            setUnknown(false);
          }}
        />
        <button type="submit" className="ol-key ol-key-amber" disabled={!validResumeCode(code)}>
          {ONLINE_WORDS.resumeKey}
        </button>
      </form>
    );
  } else if (offline) {
    crt = (
      <div className="ol-crt-body ol-offline">
        <span className="ol-crt-kicker is-bad">{ONLINE_WORDS.relay}</span>
        <span className="ol-offline-big">{ONLINE_WORDS.offline}</span>
        <span className="ol-crt-line">{ONLINE_WORDS.offlineLine}</span>
        <div className={`ol-offline-keys${room.why === 'not-set-up' ? ' is-one' : ''}`}>
          {room.why !== 'not-set-up' && (
            <button type="button" className="ol-key ol-key-dark" onClick={room.retryNow}>
              <span className="ol-key-big">{ONLINE_WORDS.retry}</span>
              <span className="ol-key-sub">{ONLINE_WORDS.retryLine(f.num(room.retry.tries), f.mmss(room.retry.nextIn_s))}</span>
            </button>
          )}
          <button type="button" className="ol-key ol-key-amber" onClick={onLocal}>
            <span className="ol-key-big">{ONLINE_WORDS.local}</span>
            <span className="ol-key-sub">{ONLINE_WORDS.localSub}</span>
          </button>
        </div>
      </div>
    );
  } else {
    crt = (
      <div className="ol-crt-body">
        <span className="ol-crt-kicker">{room.phase === 'closed' ? ONLINE_WORDS.resumeCode : ONLINE_WORDS.roomCode}</span>
        <span className="ol-code">{v ? (room.phase === 'closed' ? v.resume : v.code) : '…'}</span>
        <ol className="ol-how">
          {ONLINE_WORDS.steps.map((s, i) => (
            <li key={s}>
              <span className="ol-how-n" aria-hidden="true">
                {f.num(i + 1)}
              </span>
              {s}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const slots = (
    <div className="ol-slots">
      {(v?.slots ?? ROLE_IDS.map((role): RoomSlot => ({ role, status: 'open' }))).map((s) => (
        <Slot key={s.role} slot={s} offline={offline} {...(v && !v.started && s.seat && room.host ? { onFree: () => room.host!.free(s.seat!) } : {})} />
      ))}
    </div>
  );

  const start = (
    <button type="button" className="ol-start" disabled={!v?.canStart || offline || resuming} onClick={onStart}>
      {ONLINE_WORDS.start}
    </button>
  );

  return (
    <div className="tm ol">
      <div className="tm-frame ol-frame">
        <header className="tm-top">
          <div className="tm-brand">
            <BackButton onBack={onBack} />
            <span className="tm-brand-text">
              <span className="tm-word">{GAME_NAME}</span>
              <span className="tm-kicker">{ONLINE_WORDS.kicker}</span>
            </span>
          </div>
          {phone ? <span /> : <TeamSteps at={0} />}
          <span className="sd-top-keys">
            <span className={`tm-chip ol-chip is-${offline ? 'bad' : 'ok'}`}>
              <span className="ol-chip-dot" aria-hidden="true" />
              {chip}
            </span>
            <LangToggle />
            <SoundToggle />
            <ModeLever mode={mode} onMode={onMode} />
          </span>
        </header>
        <main className="ol-main">
          <section className="ol-crt sd-crt" aria-live="polite">
            {crt}
            {!offline && room.phase !== 'closed' && (
              <button type="button" className="ol-resume-key" aria-pressed={resuming} onClick={() => setResuming((r) => !r)}>
                {ONLINE_WORDS.resumeOpen}
              </button>
            )}
          </section>
          {slots}
        </main>
        <footer className="tm-foot ol-foot">
          <div className="tm-panel tm-say">
            <div className={`tm-say-crt sd-well ol-msg is-${msg.tone}`}>
              <span className="tm-say-prompt" aria-hidden="true">
                &gt;
              </span>
              <span className="tm-say-text">{msg.text}</span>
            </div>
            <span className="tm-hint">{note}</span>
          </div>
          {start}
        </footer>
      </div>
    </div>
  );
}
