// JOIN A ROOM (design: Signal Delay - Online Room.dc.html, screen T6b; relay offline T7e; spec: Online room). A phone
// types the code from the big screen, sees which roles are free, and joins as one. Nobody types a name: the host gives
// the phone the next call sign. A mission already under way only lets a phone take over a seat that is waiting for its
// phone. With no relay the phone offers local co-op. Words in sdWords (JOIN_WORDS); rules in engine team/room.ts.
import { useEffect, useState } from 'react';
import { ROLE_IDS, type RoleId } from '../../engine/team/roles';
import { cleanRoomCode, validRoomCode } from '../../engine/team/room';
import { BackButton } from '../components/sd/BackButton';
import { LangToggle } from '../components/sd/LangToggle';
import { SDIcon } from '../components/sd/SDIcon';
import { SoundToggle } from '../components/sd/SoundToggle';
import * as f from '../format';
import type { RoomPhone } from '../online/useRoom';
import { loadOnline } from '../saves';
import { GAME_NAME, JOIN_WORDS, ROLE_WORDS } from '../sdWords';

interface Props {
  phone: RoomPhone;
  onBack: () => void;
  /** Joined with a role (or took over a seat): the controller takes over. */
  onJoined: () => void;
  onLocal: () => void;
  /** A code from a link (#join=MARS-7K2). */
  code?: string;
}

/** The relay is offline on a phone (design T7e): what to do instead. */
export function JoinOffline({ phone, onLocal }: { phone: RoomPhone; onLocal: () => void }) {
  const notSetUp = phone.why === 'not-set-up';
  return (
    <div className="ol-join-offline">
      <div className="ol-alarm">
        <span className="ol-alarm-head">
          <span className="ol-alarm-title">{JOIN_WORDS.offlineTitle}</span>
          {!notSetUp && <span className="ol-alarm-try">{JOIN_WORDS.tryN(f.num(phone.retry.tries))}</span>}
        </span>
        <span className="ol-alarm-body">{notSetUp ? JOIN_WORDS.notSetUp : JOIN_WORDS.offlineBody(f.mmss(phone.retry.nextIn_s))}</span>
      </div>
      <span className="tm-label">{JOIN_WORDS.noRelay}</span>
      <button type="button" className="ol-way is-hot" onClick={onLocal}>
        <span className="ol-way-tile">
          <SDIcon icon="computer" size={24} color="var(--sd-paper-ink)" />
        </span>
        <span className="ol-way-text">
          <span className="ol-way-title">{JOIN_WORDS.passPhone}</span>
          <span className="ol-way-sub">{JOIN_WORDS.passPhoneSub}</span>
        </span>
      </button>
      <div className="ol-way">
        <span className="ol-way-tile is-crt">
          <SDIcon icon="dish" size={24} color="var(--sd-crt-hi)" />
        </span>
        <span className="ol-way-text">
          <span className="ol-way-title">{JOIN_WORDS.gather}</span>
          <span className="ol-way-sub">{JOIN_WORDS.gatherSub}</span>
        </span>
      </div>
      <div className="ol-join-keys">
        <button type="button" className="ol-key ol-key-amber" onClick={onLocal}>
          {JOIN_WORDS.localHere}
        </button>
        {!notSetUp && (
          <button type="button" className="ol-key ol-key-dark" onClick={phone.retryNow}>
            {JOIN_WORDS.retryNow}
          </button>
        )}
      </div>
    </div>
  );
}

export function OnlineJoin({ phone, onBack, onJoined, onLocal, code: linked }: Props) {
  const [typed, setTyped] = useState(() => linked ?? loadOnline().code ?? '');
  const [pick, setPick] = useState<RoleId>();
  const code = cleanRoomCode(typed);
  const valid = validRoomCode(code);
  const st = phone.state;
  const here = st?.code === code;

  // A whole code typed: look for the room (the relay is asked once per code).
  useEffect(() => {
    if (valid && !here) phone.join(code);
  }, [code, valid]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = here ? st?.room : undefined;
  const me = here ? st?.me : undefined;
  // back in a mission under way (a rejoin, or a seat taken over): straight to the controller
  useEffect(() => {
    if (room?.started && me && st?.status === 'linked') onJoined();
  }, [room?.started, me?.seat, st?.status]); // eslint-disable-line react-hooks/exhaustive-deps
  const offline = here ? st?.status === 'offline' || phone.why !== undefined : phone.why !== undefined;
  const takenBy = (r: RoleId) => room?.seats.find((s) => s.role === r && s.seat !== me?.seat);
  const away = room?.started ? room.seats.filter((s) => !s.linked) : [];

  let status: string | undefined;
  if (typed && !valid) status = JOIN_WORDS.badCode;
  else if (here && st?.status === 'refused') status = st.refused === 'full' ? JOIN_WORDS.full : st.refused === 'protocol' ? JOIN_WORDS.protocol : st.refused === 'started' ? JOIN_WORDS.started : undefined;
  else if (valid && !room && !offline) status = JOIN_WORDS.searching;
  else if (room) status = me ? `${JOIN_WORDS.found} · ${JOIN_WORDS.callSign(me.callSign)}` : JOIN_WORDS.found;

  const join = () => {
    if (!pick || !me) return;
    phone.pick(pick);
    onJoined();
  };

  // The code shown in boxes as the design draws it: four letters, a dash, three characters.
  const boxes = [...code.replace('-', '').padEnd(7, ' ')].slice(0, 7);

  return (
    <div className="tm ol ol-phone">
      <div className="ol-phone-frame">
        <header className="ol-phone-top">
          <BackButton onBack={onBack} />
          <span className="tm-phone-title">{GAME_NAME}</span>
          <span className="sd-top-keys">
            <LangToggle />
            <SoundToggle />
          </span>
        </header>
        <h1 className="ol-join-title">{JOIN_WORDS.title}</h1>
        <label className="ol-code-field">
          <span className="tm-label">{JOIN_WORDS.codeLabel}</span>
          <span className="ol-code-boxes" aria-hidden="true">
            {boxes.map((c, i) => (
              <span key={i} className={`ol-code-box${i === 4 ? ' after-dash' : ''}`}>
                {c.trim()}
              </span>
            ))}
          </span>
          <input
            className="ol-code-input"
            aria-label={JOIN_WORDS.codeInput}
            value={typed}
            maxLength={9}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setTyped(e.target.value)}
          />
        </label>
        {status && <span className={`ol-join-status${typed && !valid ? ' is-bad' : ''}`}>{status}</span>}
        {offline ? (
          <JoinOffline phone={phone} onLocal={onLocal} />
        ) : room?.started ? (
          <div className="ol-roles">
            {away.map((s) => (
              <button key={s.seat} type="button" className={`ol-role tm-r-${s.role ?? 'flight-director'}`} onClick={() => phone.join(code, s.seat)}>
                <span className="ol-role-tile">
                  <SDIcon icon={ROLE_WORDS[s.role ?? 'flight-director'].icon} size={24} color="var(--sd-paper-ink)" />
                </span>
                <span className="ol-role-text">
                  <span className="ol-role-name">{JOIN_WORDS.takeOver(s.callSign)}</span>
                  <span className="ol-role-duty">{s.role ? ROLE_WORDS[s.role].name : ''}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <>
            <span className="tm-label">{JOIN_WORDS.pickRole}</span>
            <div className="ol-roles">
              {ROLE_IDS.map((r) => {
                const w = ROLE_WORDS[r];
                const taken = takenBy(r);
                const mine = pick === r;
                return (
                  <button key={r} type="button" className={`ol-role tm-r-${r}${taken ? ' is-taken' : ''}`} aria-pressed={mine} disabled={!room || taken !== undefined} onClick={() => setPick(r)}>
                    <span className="ol-role-tile">
                      <SDIcon icon={w.icon} size={24} color="var(--sd-paper-ink)" />
                    </span>
                    <span className="ol-role-text">
                      <span className="ol-role-name">{w.name}</span>
                      <span className="ol-role-duty">{w.duty}</span>
                    </span>
                    <span className="ol-role-st">{taken ? taken.callSign : mine ? JOIN_WORDS.you : JOIN_WORDS.free}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="ol-join-go" disabled={!pick || !me} onClick={join}>
              {pick ? JOIN_WORDS.joinAs(ROLE_WORDS[pick].name) : JOIN_WORDS.pickFirst}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
