// MISSION OBJECTIVE (Signal Delay design: Signal Delay - Team Setup.dc.html, screen T2; spec: Team mode, Mission
// objectives). The team's first decision: the Flight Director picks what the mission is for, every other role agrees
// or objects, then the Flight Director locks it (or overrules). Roles the Flight Director's own player holds agree by
// themselves, so a team of one just picks and locks. Each pick, voice and lock is a team log entry (useTeam); what
// the cards say (targets, shares, parts, the role it leans on) and what happens next are the engine's.
import type { ObjectiveId } from '../../engine/objectives';
import type { TeamAct } from '../../engine/team/log';
import type { TeamState } from '../../engine/team/reduce';
import type { RoleId } from '../../engine/team/roles';
import { objectiveCards, objectiveVote } from '../../engine/team/setup';
import type { Design } from '../../engine/types';
import { targetSrc } from '../components/fly/Downlink';
import { BackButton } from '../components/sd/BackButton';
import { LangToggle } from '../components/sd/LangToggle';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { SoundToggle } from '../components/sd/SoundToggle';
import * as f from '../format';
import { useIsPhone } from '../sdGeometry';
import { OBJECTIVE_WORDS, PART_LOOK, ROLE_WORDS, TEAM_WORDS, targetName } from '../sdWords';
import { SeatBadge, TeamSteps } from './TeamSetup';

interface Props {
  /** The team so far (set up: the log's first entry). */
  state: TeamState;
  /** The Mars design the cards are read against (does it already carry a matching part?). */
  design: Design;
  onSend: (role: RoleId, act: TeamAct) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  onBack: () => void;
  /** NEXT · PACK, once the objective is locked. */
  onNext: (objective: ObjectiveId) => void;
}

export function TeamObjective({ state, design, onSend, mode, onMode, onBack, onNext }: Props) {
  const phone = useIsPhone();
  const team = state.team ?? { seats: [] };
  const vote = objectiveVote(state);
  const cards = objectiveCards(design);
  const solo = team.seats.length === 1;
  const fd = team.seats.find((s) => s.roles.includes('flight-director')) ?? team.seats[0];
  const sign = (r: RoleId) => team.seats.find((s) => s.roles.includes(r))?.callSign ?? fd?.callSign ?? '';
  const locked = vote.next === 'locked';
  const titleOf = (id: ObjectiveId) => OBJECTIVE_WORDS.objectives[id].title;

  const objectorNames = TEAM_WORDS.join(vote.objectors.map((r) => ROLE_WORDS[r].short));
  const msg =
    vote.next === 'locked' && vote.objective
      ? vote.locked === 'overruled'
        ? OBJECTIVE_WORDS.msgOverruled(titleOf(vote.objective))
        : OBJECTIVE_WORDS.msgLocked(titleOf(vote.objective))
      : vote.next === 'pick'
        ? OBJECTIVE_WORDS.msgPick
        : vote.objectors.length
          ? OBJECTIVE_WORDS.msgObject(objectorNames, vote.objectors.length === 1)
          : vote.next === 'wait'
            ? OBJECTIVE_WORDS.msgWait(f.num(vote.waiting), vote.waiting === 1)
            : OBJECTIVE_WORDS.msgAll;
  const lockLabel = { pick: OBJECTIVE_WORDS.lock, wait: OBJECTIVE_WORDS.waiting, lock: OBJECTIVE_WORDS.lock, overrule: OBJECTIVE_WORDS.overrule, locked: OBJECTIVE_WORDS.nextPack }[vote.next];
  const lockOn = vote.next === 'lock' || vote.next === 'overrule' || vote.next === 'locked';
  const lock = () => {
    if (vote.next === 'locked' && vote.objective) onNext(vote.objective);
    else if (lockOn) onSend('flight-director', { kind: 'objective-lock' });
  };
  const pick = (id: ObjectiveId) => !locked && id !== vote.objective && onSend('flight-director', { kind: 'objective', objective: id });

  const objs = (
    <div className="ob-cards">
      {cards.map((c, i) => {
        const picked = vote.objective === c.id;
        const w = OBJECTIVE_WORDS.objectives[c.id];
        const strain = ROLE_WORDS[c.strain.value.role];
        return (
          <button
            key={c.id}
            type="button"
            className={`ob-card tm-r-${c.strain.value.role}${picked ? ' picked' : ''}${vote.objective && !picked ? ' dim' : ''}`}
            aria-pressed={picked}
            disabled={locked && !picked}
            onClick={() => pick(c.id)}
          >
            <span className={`ob-imgs n-${phone ? 1 : c.targets.length}`} aria-hidden="true">
              {(phone ? c.targets.slice(0, 1) : c.targets).map((t) => (
                <img key={t.id} src={targetSrc(t.id)} alt="" loading="lazy" />
              ))}
            </span>
            <span className="ob-body">
              {!phone && <span className="ob-num">{OBJECTIVE_WORDS.num(f.num(i + 1))}</span>}
              <span className="ob-title">{w.title}</span>
              {phone ? (
                <span className="ob-keyline">{c.targets.map((t) => targetName(t.id)).join(' · ')}</span>
              ) : (
                <>
                  <span className="ob-line">{w.line}</span>
                  <span className="ob-matters">
                    <span className="ob-k">{OBJECTIVE_WORDS.matters}</span>
                    {c.targets.map((t) => (
                      <span key={t.id} className="ob-target">
                        <span className="ob-target-name">{targetName(t.id)}</span>
                        <span className="ob-share">{OBJECTIVE_WORDS.share(f.pct(t.share, 0))}</span>
                      </span>
                    ))}
                    <span className="ob-needs">
                      {OBJECTIVE_WORDS.needs(c.parts.map((p) => PART_LOOK[p].short).join(OBJECTIVE_WORDS.or))}
                      {c.matched && <span className="ob-onboard">{OBJECTIVE_WORDS.packed}</span>}
                    </span>
                  </span>
                </>
              )}
              <span className="ob-strain">
                <span className="ob-strain-bar" aria-hidden="true" />
                {phone ? (
                  <span className="ob-strain-text">{OBJECTIVE_WORDS.strainShort(strain.ab, OBJECTIVE_WORDS.why[c.strain.value.why])}</span>
                ) : (
                  <span className="ob-strain-text">
                    <span className="ob-strain-why">{OBJECTIVE_WORDS.hardest(OBJECTIVE_WORDS.why[c.strain.value.why])}</span>
                    <span className="ob-strain-role">{strain.name}</span>
                  </span>
                )}
              </span>
            </span>
            {picked && <span className={`ob-stamp${locked ? ' locked' : ''}`}>{locked ? OBJECTIVE_WORDS.stampLocked : OBJECTIVE_WORDS.stampPick}</span>}
          </button>
        );
      })}
    </div>
  );

  const voters = (
    <div className="ob-voters">
      {vote.voters.map((v) => {
        const w = ROLE_WORDS[v.role];
        const can = !v.auto && !!vote.objective && !locked;
        const say = (voice: 'agree' | 'object') => can && onSend(v.role, { kind: 'objective-voice', voice: v.voice === voice ? 'none' : voice });
        return (
          <section key={v.role} className={`ob-voter tm-r-${v.role}`} aria-label={w.name}>
            <span className="ob-voter-bar" aria-hidden="true" />
            <div className="ob-voter-body">
              <div className="ob-voter-head">
                <span className="ob-voter-name">{phone ? w.short : w.name}</span>
                <span className="ob-voter-who">{sign(v.role)}</span>
              </div>
              {v.auto ? (
                <span className="ob-auto">{phone ? OBJECTIVE_WORDS.autoShort : OBJECTIVE_WORDS.auto}</span>
              ) : (
                <div className="ob-votes">
                  <button type="button" className="ob-vote agree" aria-pressed={v.voice === 'agree'} disabled={!can} aria-label={OBJECTIVE_WORDS.voteTitle(w.name, OBJECTIVE_WORDS.agree)} onClick={() => say('agree')}>
                    {!phone && <SDIcon icon="check" size={18} color="currentColor" />}
                    {OBJECTIVE_WORDS.agree}
                  </button>
                  <button type="button" className="ob-vote object" aria-pressed={v.voice === 'object'} disabled={!can} aria-label={OBJECTIVE_WORDS.voteTitle(w.name, OBJECTIVE_WORDS.object)} onClick={() => say('object')}>
                    {!phone && <SDIcon icon="cross" size={16} color="currentColor" />}
                    {OBJECTIVE_WORDS.object}
                  </button>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );

  const msgEl = <div className={`ob-msg sd-well${vote.objectors.length && !locked ? ' warn' : ''}`}>{msg}</div>;
  const lockEl = (
    <button type="button" className="ob-lock" disabled={!lockOn} onClick={lock}>
      {lockLabel}
    </button>
  );

  return (
    <div className={`sd tm ob${phone ? ' phone' : ''}`}>
      <div className="tm-frame">
        <header className="tm-top">
          <span className="tm-brand">
            <BackButton onBack={onBack} />
            {phone ? (
              <span className="tm-phone-title">{OBJECTIVE_WORDS.phoneTitle}</span>
            ) : (
              <span className="tm-brand-text">
                <span className="tm-word">SIGNAL DELAY</span>
                <span className="tm-kicker">{TEAM_WORDS.kicker}</span>
              </span>
            )}
          </span>
          {!phone && <TeamSteps at={0} />}
          <span className="sd-top-keys">
            {!phone && fd && (
              <span className="ob-picks">
                <span className="tm-label">{OBJECTIVE_WORDS.picks}</span>
                <span className="ob-fd tm-r-flight-director">
                  <span className="ob-fd-star">
                    <SDIcon icon="star" size={15} color="var(--role)" />
                  </span>
                  {OBJECTIVE_WORDS.fdChip(fd.callSign)}
                </span>
              </span>
            )}
            <LangToggle />
            <SoundToggle />
            <ModeLever mode={mode} onMode={onMode} />
          </span>
        </header>

        {phone ? (
          <main className="tm-main">
            {fd && (
              <div className="ob-fd-strip tm-r-flight-director">
                <SeatBadge seat={fd.id} sign={fd.callSign} />
                <span>{solo ? OBJECTIVE_WORDS.soloPhone : OBJECTIVE_WORDS.fdPhone(fd.callSign)}</span>
              </div>
            )}
            {objs}
            {voters}
            {msgEl}
            {lockEl}
          </main>
        ) : (
          <>
            <main className="tm-main ob-main">{objs}</main>
            <footer className="ob-foot">
              {voters}
              <div className="tm-panel ob-lockbox">
                {msgEl}
                {lockEl}
              </div>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
