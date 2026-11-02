// TEAM SETUP (Signal Delay design: Signal Delay - Team Setup.dc.html, screen T1; spec: Team mode). Solo or team,
// one to four players, and who holds which of the four roles. Each seat has a call sign from the preset list (tap it
// for the next one; nobody types a name). A tap on HELD BY hands a role to the next player. ONLINE ROOM (a team only)
// opens a room the phones join instead (screens/OnlineHost.tsx). Every rule is the engine's (team/setup.ts); words in
// sdWords (TEAM_WORDS).
import { useRef } from 'react';
import { ROLE_IDS, type RoleId, type SeatId, type Team } from '../../engine/team/roles';
import { crewView, handRole, nextCallSign, setPlayers } from '../../engine/team/setup';
import { BackButton } from '../components/sd/BackButton';
import { LangToggle } from '../components/sd/LangToggle';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { SoundToggle } from '../components/sd/SoundToggle';
import * as f from '../format';
import { useIsPhone } from '../sdGeometry';
import { ROLE_WORDS, TEAM_WORDS } from '../sdWords';

/** The design's PLAYERS keys (a team of one is the SOLO key). */
const TEAM_SIZES = [2, 3, 4];

interface Props {
  team: Team;
  onTeam: (t: Team) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  onBack: () => void;
  /** NEXT · OBJECTIVE: the team is set up. */
  onNext: () => void;
  /** LOCAL (one shared screen) or ONLINE ROOM (each player on a phone; spec: Online room). */
  place: 'local' | 'online';
  onPlace: (p: 'local' | 'online') => void;
  /** NEXT · OPEN ROOM. */
  onRoom: () => void;
}

/** The step dots along the top: 0 TEAM, 1 PACK, 2 FLY, 3 REPORT (this screen is step 0). */
export function TeamSteps({ at }: { at: number }) {
  return (
    <ol className="tm-steps" aria-label={TEAM_WORDS.kicker}>
      {TEAM_WORDS.steps.map((w, i) => (
        <li key={w} className={i === at ? 'on' : i < at ? 'done' : ''}>
          <span className="tm-step-dot" aria-hidden="true" />
          {TEAM_WORDS.step(f.num(i), w)}
        </li>
      ))}
    </ol>
  );
}

/** A seat's round badge: its call sign's first letter, in the seat's colour. */
export function SeatBadge({ seat, sign }: { seat: SeatId; sign: string }) {
  return (
    <span className={`tm-seat tm-seat-${seat}`} aria-hidden="true">
      {sign.slice(0, 1)}
    </span>
  );
}

export function TeamSetup({ team, onTeam, mode, onMode, onBack, onNext, place, onPlace, onRoom }: Props) {
  const phone = useIsPhone();
  const crew = crewView(team);
  const solo = crew.players === 1;
  /** The team size SOLO → TEAM goes back to. */
  const lastTeam = useRef(solo ? 4 : crew.players);
  if (!solo) lastTeam.current = crew.players;
  const sign = (id: SeatId) => team.seats.find((s) => s.id === id)?.callSign ?? '';
  const holder = (r: RoleId) => team.seats.find((s) => s.roles.includes(r));
  const names = (ids: SeatId[]) => TEAM_WORDS.join(ids.map(sign));

  /** The online room: each phone takes its own role there, so the crew on this screen does not apply. */
  const online = place === 'online' && !solo;
  const line1 = solo ? TEAM_WORDS.lineSolo : online ? TEAM_WORDS.lineOnline : TEAM_WORDS.lineTeam(f.num(crew.players));
  const line2 = solo ? TEAM_WORDS.soloNoVotes : online ? TEAM_WORDS.onlineCrew : crew.doubled.length ? TEAM_WORDS.doubled(names(crew.doubled), crew.doubled.length > 1) : TEAM_WORDS.oneEach;
  const ready = online || crew.idle.length === 0;
  const msg = online ? TEAM_WORDS.nextRoomMsg : ready ? TEAM_WORDS.nextObjective : TEAM_WORDS.idle(names(crew.idle));
  const chip = solo ? TEAM_WORDS.chipSolo : online ? TEAM_WORDS.chipOnline : phone ? TEAM_WORDS.chipShort(f.num(crew.players)) : TEAM_WORDS.chipCrew(f.num(crew.players));

  const modeKeys = (
    <div className="tm-modes">
      {[
        { on: solo, label: TEAM_WORDS.solo, sub: TEAM_WORDS.soloSub, go: () => onTeam(setPlayers(team, 1)) },
        { on: !solo, label: TEAM_WORDS.team, sub: TEAM_WORDS.teamSub, go: () => solo && onTeam(setPlayers(team, lastTeam.current)) },
      ].map((k) => (
        <button key={k.label} type="button" className="tm-key tm-mode" aria-pressed={k.on} onClick={k.go}>
          <span className="tm-mode-label">{k.label}</span>
          <span className="tm-mode-sub">{k.sub}</span>
        </button>
      ))}
    </div>
  );

  const sizeKeys = (
    <div className="tm-sizes" role="group" aria-label={TEAM_WORDS.players}>
      {phone && <span className="tm-label">{TEAM_WORDS.players}</span>}
      {TEAM_SIZES.map((n) => (
        <button key={n} type="button" className="tm-key tm-size" aria-pressed={!solo && crew.players === n} disabled={solo} onClick={() => onTeam(setPlayers(team, n))}>
          {f.num(n)}
        </button>
      ))}
    </div>
  );

  const signKeys = (
    <div className="tm-signs" role="group" aria-label={TEAM_WORDS.callSigns}>
      {phone && <span className="tm-label">{TEAM_WORDS.callSigns}</span>}
      {team.seats.map((s) => (
        <button key={s.id} type="button" className="tm-sign" title={TEAM_WORDS.callSignTitle(s.callSign)} aria-label={TEAM_WORDS.callSignTitle(s.callSign)} onClick={() => onTeam(nextCallSign(team, s.id))}>
          <SeatBadge seat={s.id} sign={s.callSign} />
          <span className="tm-sign-name">{s.callSign}</span>
        </button>
      ))}
    </div>
  );

  const placeKeys = (
    <div className="tm-places">
      {[
        { on: !online, off: false, label: TEAM_WORDS.local, sub: phone ? TEAM_WORDS.localShort : TEAM_WORDS.localSub, icon: 'computer' as const, go: () => onPlace('local') },
        // an online room is for a team: SOLO greys it out (design T1)
        { on: online, off: solo, label: TEAM_WORDS.online, sub: phone ? TEAM_WORDS.onlineShort : TEAM_WORDS.onlineSub, icon: 'dish' as const, go: () => onPlace('online') },
      ].map((k) => (
        <button key={k.label} type="button" className="tm-key tm-place" aria-pressed={k.on} disabled={k.off} title={k.off ? TEAM_WORDS.soloNoRoom : undefined} onClick={k.go}>
          <span className="tm-place-icon">
            <SDIcon icon={k.icon} size={phone ? 20 : 24} color={k.on ? 'var(--sd-paper-ink)' : 'var(--sd-crt-hi)'} />
          </span>
          <span className="tm-place-text">
            <span className="tm-place-label">{k.label}</span>
            <span className="tm-place-sub">{k.sub}</span>
          </span>
        </button>
      ))}
    </div>
  );

  const roles = (
    <div className="tm-roles">
      {ROLE_IDS.map((r, i) => {
        const w = ROLE_WORDS[r];
        const h = holder(r);
        const held = h?.roles.length ?? 0;
        return (
          <section key={r} className={`tm-role tm-r-${r}`} aria-label={w.name}>
            <div className="tm-role-head">
              <span className="tm-role-tile">
                <SDIcon icon={w.icon} size={phone ? 22 : 28} color={phone ? 'var(--sd-paper-ink)' : 'var(--role)'} />
              </span>
              <span className="tm-role-titles">
                <span className="tm-role-num">{TEAM_WORDS.role(f.num(i + 1), w.ab)}</span>
                <span className="tm-role-name">{w.name}</span>
              </span>
              {phone && h && (
                <button type="button" className="tm-held" disabled={solo} aria-label={TEAM_WORDS.handOn(w.name, h.callSign)} onClick={() => onTeam(handRole(team, r))}>
                  <SeatBadge seat={h.id} sign={h.callSign} />
                  <span className="tm-held-name">{h.callSign}</span>
                </button>
              )}
            </div>
            <div className="tm-role-body">
              <span className="tm-role-duty">{w.duty}</span>
              {!phone && (
                <span className="tm-owns">
                  {w.owns.map((o) => (
                    <span key={o.label} className="tm-own">
                      <SDIcon icon={o.icon} size={15} color="var(--role)" />
                      {o.label}
                    </span>
                  ))}
                </span>
              )}
              {!phone && h && (
                <span className="tm-held-row">
                  <span className="tm-label">{TEAM_WORDS.heldBy}</span>
                  <button type="button" className="tm-held" disabled={solo} title={TEAM_WORDS.handOn(w.name, h.callSign)} aria-label={TEAM_WORDS.handOn(w.name, h.callSign)} onClick={() => onTeam(handRole(team, r))}>
                    <SeatBadge seat={h.id} sign={h.callSign} />
                    <span className="tm-held-name">{h.callSign}</span>
                    {!solo && held > 1 && <span className="tm-held-multi">{TEAM_WORDS.roles(f.num(held))}</span>}
                  </button>
                </span>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );

  const next = (
    <button type="button" className="tm-next" disabled={!ready} onClick={online ? onRoom : onNext}>
      {online ? TEAM_WORDS.nextRoom : TEAM_WORDS.next}
    </button>
  );

  return (
    <div className={`sd tm${phone ? ' phone' : ''}`}>
      <div className="tm-frame">
        <header className="tm-top">
          <span className="tm-brand">
            <BackButton onBack={onBack} />
            {phone ? (
              <span className="tm-phone-title">{TEAM_WORDS.step(f.num(0), TEAM_WORDS.steps[0]!)}</span>
            ) : (
              <span className="tm-brand-text">
                <span className="tm-word">SIGNAL DELAY</span>
                <span className="tm-kicker">{TEAM_WORDS.kicker}</span>
              </span>
            )}
          </span>
          {!phone && <TeamSteps at={0} />}
          <span className="sd-top-keys">
            <span className="tm-chip">{chip}</span>
            <LangToggle />
            <SoundToggle />
            <ModeLever mode={mode} onMode={onMode} />
          </span>
        </header>

        {phone ? (
          <main className="tm-main">
            {modeKeys}
            {sizeKeys}
            {signKeys}
            {placeKeys}
            {roles}
            <div className="tm-crt sd-well">
              <span className="tm-crt-1">{line1}</span>
            </div>
            <div className="tm-msg-phone">{msg}</div>
            {next}
          </main>
        ) : (
          <>
            <main className="tm-main">
              <aside className="tm-panel tm-crew">
                <div className="tm-panel-head">
                  <span className="tm-panel-title">{TEAM_WORDS.crew}</span>
                  <span className="tm-label">{TEAM_WORDS.whoFlies}</span>
                </div>
                <span className="tm-label">{TEAM_WORDS.play}</span>
                {modeKeys}
                <span className="tm-label">{TEAM_WORDS.players}</span>
                {sizeKeys}
                <span className="tm-label">{TEAM_WORDS.callSigns}</span>
                {signKeys}
                <span className="tm-label">{TEAM_WORDS.where}</span>
                {placeKeys}
                <div className="tm-crt sd-well">
                  <span className="tm-crt-1">{line1}</span>
                  <span className="tm-crt-2">{line2}</span>
                </div>
              </aside>
              {roles}
            </main>
            <footer className="tm-foot">
              <div className="tm-panel tm-say">
                <div className="tm-say-crt sd-well">
                  <span className="tm-say-prompt" aria-hidden="true">
                    &gt;
                  </span>
                  <span className="tm-say-text">{msg}</span>
                </div>
                <span className="tm-hint">{TEAM_WORDS.tapHint}</span>
              </div>
              {next}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
