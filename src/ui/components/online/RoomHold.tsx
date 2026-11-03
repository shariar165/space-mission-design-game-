// The host screen while a phone is away (design: Signal Delay - Online Room.dc.html, T7a "PLAYER RECONNECTING";
// spec: Online room). The clock holds while the role is held; the bar runs down; HAND NOW gives the role to the Flight
// Director (or the first phone still linked). Once handed, RESUME MISSION closes the panel and play goes on. The room
// chip (RoomBar) sits on every host screen of a room's mission. Numbers from engine roomView.
import type { RoomView } from '../../../engine/team/room';
import * as f from '../../format';
import { ONLINE_WORDS, ROLE_WORDS } from '../../sdWords';
import { SDIcon } from '../sd/SDIcon';

export function RoomBar({ view, held }: { view: RoomView; held: boolean }) {
  return (
    <span className={`ol-bar${held ? ' is-held' : ''}`} role="status">
      <span className="ol-chip-dot" aria-hidden="true" />
      {held ? ONLINE_WORDS.chipPaused(f.num(view.linked), f.num(view.max)) : ONLINE_WORDS.bar(view.code, f.num(view.linked), f.num(view.max))}
    </span>
  );
}

interface Props {
  view: RoomView;
  /** The mission day on the host's flight (absent before launch). */
  day?: number;
  onHand: () => void;
  onResume: () => void;
}

export function RoomHold({ view, day, onHand, onResume }: Props) {
  const m = view.message;
  if (m.kind !== 'away' && m.kind !== 'handed') return null;
  const away = m.kind === 'away';
  const role = ROLE_WORDS[m.role];
  return (
    <div className="ol-hold" role="dialog" aria-modal="true" aria-label={away ? ONLINE_WORDS.reconnecting : ONLINE_WORDS.roleHanded}>
      <div className={`ol-hold-card sd-crt tm-r-${m.role}`}>
        {day !== undefined && <span className="ol-crt-kicker is-warn">{ONLINE_WORDS.paused(f.dayPad(day))}</span>}
        <span className="ol-hold-big">{away ? ONLINE_WORDS.reconnecting : ONLINE_WORDS.roleHanded}</span>
        <span className="ol-hold-who">
          <span className="ol-hold-tile">
            <SDIcon icon={role.icon} size={28} color="var(--sd-paper-ink)" />
          </span>
          {away ? ONLINE_WORDS.reconWho(m.callSign, role.name) : ONLINE_WORDS.handedWho(role.name, m.heldBy)}
        </span>
        {away && (
          <span className="ol-hold-meter" aria-hidden="true">
            <span className="ol-hold-fill" style={{ width: `${f.num(m.holdFraction * 100, 1)}%` }} />
          </span>
        )}
        <span className="ol-crt-line">{away ? ONLINE_WORDS.reconLine(f.mmss(m.holdLeft_s)) : ONLINE_WORDS.handedLine(m.callSign)}</span>
        <span className="ol-hold-note">{ONLINE_WORDS.noteAway}</span>
        {away ? (
          m.heir && (
            <button type="button" className="ol-key ol-key-amber" onClick={onHand}>
              {ONLINE_WORDS.handNow(role.ab, m.heir)}
            </button>
          )
        ) : (
          <button type="button" className="ol-key ol-key-amber" onClick={onResume}>
            {ONLINE_WORDS.resumeKey}
          </button>
        )}
      </div>
    </div>
  );
}
