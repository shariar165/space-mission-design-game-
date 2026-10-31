// Team mode panels on a shared screen (spec: Team mode; design: Signal Delay - Team Play.dc.html, T3 Team Pack and
// the bar along T4's bottom). SHARED LIMITS (each role's part of the mass and the budget), the conflict banner, the
// TEAM LINE (the preset messages so far) and the quick-message bar with SPEAKING AS. Every number comes from the
// engine (team/negotiate.ts teamSpend, spendShares); the words from sdWords (TEAM_PACK_WORDS, QUICK_WORDS).
import type { TeamAction } from '../../../engine/team/log';
import type { TeamSpend } from '../../../engine/team/negotiate';
import { spendShares } from '../../../engine/team/negotiate';
import type { TeamState } from '../../../engine/team/reduce';
import { ROLE_IDS, TEAM_RULES, type RoleId, type Team } from '../../../engine/team/roles';
import * as f from '../../format';
import { QUICK_WORDS, ROLE_WORDS, TEAM_PACK_WORDS } from '../../sdWords';
import { SDIcon } from '../sd/SDIcon';

/** The four seats' call signs along the top, each with the icons of the roles it holds. */
export function CrewChips({ team }: { team: Team }) {
  return (
    <span className="tp-crew">
      {team.seats.map((s) => (
        <span key={s.id} className={`tp-crew-chip tm-r-${s.roles[0] ?? 'flight-director'}`}>
          {s.roles.map((r) => (
            <span key={r} className={`tp-crew-icon tm-r-${r}`}>
              <SDIcon icon={ROLE_WORDS[r].icon} size={11} color="var(--sd-paper-ink)" />
            </span>
          ))}
          {s.callSign}
        </span>
      ))}
    </span>
  );
}

/** SHARED LIMITS: one bar per limit split by role, and the table of each role's mass, cost and share. */
export function SharedLimits({ spend, compact }: { spend: TeamSpend; compact?: boolean }) {
  const sh = spendShares(spend);
  const bar = (k: 'massOfLimit' | 'costOfLimit', over: boolean, label: string, value: string) => (
    <div className="tp-limit">
      <div className="tp-limit-head">
        <span className="tm-label">{label}</span>
        <span className={`tp-limit-v${over ? ' over' : ''}`}>{value}</span>
      </div>
      <div className={`tp-bar sd-well${over ? ' over' : ''}`} role="img" aria-label={`${label}: ${value}`}>
        {ROLE_IDS.map((r) => (
          <span key={r} className={`tp-seg tm-r-${r}`} style={{ width: `${Math.min(100, sh.roles[r][k] * 100)}%` }} />
        ))}
        <span className="tp-bar-line" />
      </div>
    </div>
  );
  return (
    <section className={`tm-panel tp-limits${compact ? ' compact' : ''}`} aria-label={TEAM_PACK_WORDS.limits}>
      {!compact && <span className="tp-title">{TEAM_PACK_WORDS.limits}</span>}
      {bar('massOfLimit', sh.mass.over > 0, TEAM_PACK_WORDS.mass, TEAM_PACK_WORDS.of(f.num(sh.mass.used), f.kg(sh.mass.limit)))}
      {bar('costOfLimit', sh.cost.over > 0, TEAM_PACK_WORDS.budget, TEAM_PACK_WORDS.of(f.money(sh.cost.used), f.money(sh.cost.limit)))}
      {!compact && (
        <table className="tp-table">
          <thead>
            <tr>
              <th>{TEAM_PACK_WORDS.colRole}</th>
              <th>{TEAM_PACK_WORDS.colMass}</th>
              <th>{TEAM_PACK_WORDS.colCost}</th>
              <th>{TEAM_PACK_WORDS.colShare}</th>
            </tr>
          </thead>
          <tbody>
            {ROLE_IDS.map((r) => (
              <tr key={r} className={`tm-r-${r}`}>
                <td>
                  <span className="tp-swatch" />
                  {ROLE_WORDS[r].ab}
                </td>
                <td>{f.num(spend.roles[r].mass_kg)}</td>
                <td>{f.money(spend.roles[r].cost_M)}</td>
                <td>{f.pct(sh.roles[r].costShare, 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** The red banner over the nose: which limit is over, by how much, and the roles that have to talk. */
export function ConflictBanner({ spend, noRoom }: { spend: TeamSpend; noRoom?: { part: string; role: RoleId } }) {
  const sh = spendShares(spend);
  const res = spend.over.mass ? 'mass' : spend.over.cost ? 'cost' : noRoom ? 'room' : undefined;
  if (!res) return null;
  const roles = res === 'room' ? [noRoom!.role] : spend.over[res]!;
  const by = res === 'mass' ? f.kg(sh.mass.over) : res === 'cost' ? f.money(sh.cost.over) : undefined;
  return (
    <div className="tp-conflict" role="alert">
      <div className="tp-conflict-head">
        <span className="tp-conflict-title">{TEAM_PACK_WORDS.over[res]}</span>
        {by && <span className="tp-conflict-by">{TEAM_PACK_WORDS.overBy(by)}</span>}
      </div>
      <div className="tp-conflict-roles">
        {roles.map((r, i) => (
          <span key={r} className="tp-conflict-pair">
            {i > 0 && (
              <span className="tp-conflict-vs" aria-hidden="true">
                ⇄
              </span>
            )}
            <span className={`tp-role-pill tm-r-${r}`}>
              <span className="tp-role-dot" />
              {ROLE_WORDS[r].name}
            </span>
          </span>
        ))}
      </div>
      <span className="tp-conflict-line">{res === 'room' ? TEAM_PACK_WORDS.roomLine(noRoom!.part) : TEAM_PACK_WORDS.overLine}</span>
    </div>
  );
}

/** TEAM LINE: the preset messages so far, newest last, each with the role that said it. */
export function TeamLine({ state, log, max = 6 }: { state: TeamState; log: readonly TeamAction[]; max?: number }) {
  const roleOf = (seq: number) => log.find((a) => a.seq === seq)?.role ?? 'flight-director';
  const shown = state.feed.slice(-max);
  return (
    <section className="tp-line sd-paper" aria-label={TEAM_PACK_WORDS.line}>
      <div className="tp-line-head">
        <span>{TEAM_PACK_WORDS.line}</span>
        <span>{TEAM_PACK_WORDS.msgs(f.num(state.feed.length))}</span>
      </div>
      <ol className="tp-line-list" aria-live="polite">
        {shown.length === 0 && <li className="tp-line-empty">{TEAM_PACK_WORDS.empty}</li>}
        {shown.map((m) => {
          const r = roleOf(m.seq);
          return (
            <li key={m.seq} aria-label={TEAM_PACK_WORDS.say(ROLE_WORDS[r].name, QUICK_WORDS[m.quick] ?? m.quick)}>
              <span className={`tp-line-role tm-r-${r}`}>{ROLE_WORDS[r].ab}</span>
              <span className="tp-line-text">{QUICK_WORDS[m.quick] ?? m.quick}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** SPEAKING AS (one key per role) and the preset messages: no free text anywhere. */
export function QuickBar({ speaker, onSpeaker, onSay }: { speaker: RoleId; onSpeaker: (r: RoleId) => void; onSay: (quick: string) => void }) {
  return (
    <section className="tm-panel tp-quick" aria-label={TEAM_PACK_WORDS.speakingAs}>
      <div className="tp-as">
        <span className="tm-label">{TEAM_PACK_WORDS.speakingAs}</span>
        <span className="tp-as-keys">
          {ROLE_IDS.map((r) => (
            <button key={r} type="button" className={`tp-as-key tm-r-${r}`} aria-pressed={speaker === r} aria-label={TEAM_PACK_WORDS.speakAs(ROLE_WORDS[r].name)} title={ROLE_WORDS[r].name} onClick={() => onSpeaker(r)}>
              <SDIcon icon={ROLE_WORDS[r].icon} size={18} color={speaker === r ? 'var(--sd-paper-ink)' : 'var(--role)'} />
            </button>
          ))}
        </span>
      </div>
      <div className="tp-msgs">
        {TEAM_RULES.quick.value.map((q) => (
          <button key={q} type="button" className="tp-msg" onClick={() => onSay(q)}>
            {QUICK_WORDS[q] ?? q}
          </button>
        ))}
      </div>
    </section>
  );
}
