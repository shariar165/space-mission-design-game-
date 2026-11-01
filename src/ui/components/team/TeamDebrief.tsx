// TEAM DEBRIEF (spec: Team mode, Team report, UI rule 52; design: Signal Delay - Team Play.dc.html, T5). The Mission
// Report's Team section, after the album and before FINAL TRANSMISSION: one row per role with the call that mattered
// most, what it did and a stamp, and the TEAM SCORE in its three parts. Every count and the score come from the engine
// (team/report.ts teamReport); the team score never touches the stars.
import type { ReactNode } from 'react';
import { HAZARDS } from '../../../engine/data';
import type { TeamReport, TeamRow } from '../../../engine/team/report';
import type { TeamState } from '../../../engine/team/reduce';
import * as f from '../../format';
import { dangerLook, dayCount, OBJECTIVE_WORDS, optionShort, PART_LOOK, ROLE_WORDS, TEAM_REPORT_WORDS as W, targetName } from '../../sdWords';
import { SDIcon } from '../sd/SDIcon';

const hazardName = (type: string) => dangerLook(type, HAZARDS[type]?.title ?? type).title;
const optionName = (type: string, id: string) => optionShort(type, id, HAZARDS[type]?.options.find((o) => o.id === id)?.label ?? id);

/** The row's words: the kicker, the key decision, what it did and the stamp. */
function rowWords(row: TeamRow, state: TeamState) {
  const k = row.key;
  const stamp = W.verdict[k.kind]?.[row.verdict] ?? '';
  switch (k.kind) {
    case 'objective': {
      const title = OBJECTIVE_WORDS.objectives[k.objective].title;
      return { when: W.when.objective, call: W.call.objective(title, state.objectiveLocked?.how === 'overruled'), effect: undefined, stamp };
    }
    case 'card': {
      const chosen = optionName(k.hazardType, k.optionId);
      const first = row.role === 'flight-director' ? W.call.called(chosen) : W.call.recommended(optionName(k.hazardType, k.recommended));
      const team = k.how === 'solo' ? '' : k.optionId === k.recommended ? W.call.agreed(f.num(k.support), f.num(k.against)) : W.call.chose(chosen, f.num(k.support), f.num(k.against));
      return {
        when: k.day !== undefined ? W.when.card(f.dayPad(k.day), hazardName(k.hazardType)) : hazardName(k.hazardType),
        call: team ? `${first} ${team}` : first,
        effect: k.bad ? W.effect.cardBad : W.effect.cardGood,
        stamp,
      };
    }
    case 'observe':
      return {
        when: W.when.observe,
        call: W.call.observe(f.num(k.ordered.length), k.ordered.length === 1),
        effect: W.effect.observe(f.num(k.home.length), f.num(k.ordered.length), k.ordered.map(targetName).join(', '), f.pct(k.science, 0)),
        stamp,
      };
    case 'dsn':
      return { when: W.when.dsn, call: W.call.dsn(dayCount(k.days).toUpperCase()), effect: W.effect.dsn, stamp };
    case 'part':
      return {
        when: W.when.part,
        call: W.call.part(PART_LOOK[k.part].name.toUpperCase()),
        effect: k.covered.length ? W.effect.part(k.covered.map((h) => hazardName(h).toLowerCase()).join(', ')) : W.effect.partIdle,
        stamp,
      };
    case 'none':
      return { when: W.when.none, call: W.call.none, effect: W.effect.none, stamp };
  }
}

interface Props {
  report: TeamReport;
  state: TeamState;
  phone: boolean;
  /** NEXT · FINAL TRANSMISSION. */
  onNext: () => void;
  /** ◂ BACK, when the debrief opens the report (no album before it). */
  back?: ReactNode;
}

export function TeamDebrief({ report, state, phone, onNext, back }: Props) {
  const seats = state.team?.seats.length ?? 0;
  const objective = state.objective ? OBJECTIVE_WORDS.objectives[state.objective].title : undefined;
  // The objective row's effect is the engine's objective result.
  const objectiveEffect = report.objective
    ? report.objective.matched
      ? W.effect.objective(f.pct(report.objective.favouredHome, 0), report.objective.met)
      : W.effect.noInstrument
    : undefined;
  const partLine = (id: TeamReport['parts'][number]['id'], n: number, of: number) =>
    id === 'votes' ? (of ? W.votesLine(f.num(n), f.num(of)) : W.noVotes) : id === 'conflicts' ? (of ? W.conflictsLine(f.num(n), f.num(of)) : W.noConflicts) : W.objectiveLine(objective ?? '', n > 0);
  const partShort = (id: TeamReport['parts'][number]['id'], n: number, of: number) => (id === 'objective' ? (n > 0 ? W.met : W.missed) : of ? W.nOf(f.num(n), f.num(of)) : W.none);

  const rows = report.rows.map((row) => {
    const w = rowWords(row, state);
    const effect = row.key.kind === 'objective' ? objectiveEffect : w.effect;
    const who = row.callSign ? `${ROLE_WORDS[row.role].name} · ${row.callSign}` : ROLE_WORDS[row.role].name;
    return (
      <li key={row.role} className={`td-row tm-r-${row.role}`} aria-label={who}>
        <span className="td-bar" />
        {phone ? (
          <div className="td-body">
            <div className="td-line">
              <span className="td-who">{who}</span>
              <span className={`td-stamp ${row.verdict}`}>{w.stamp}</span>
            </div>
            <span className="td-call">{w.call}</span>
            {effect && <span className="td-effect">{effect}</span>}
          </div>
        ) : (
          <>
            <span className="td-role">
              <span className="td-role-name">{ROLE_WORDS[row.role].name}</span>
              {row.callSign && (
                <span className="td-sign">
                  <SDIcon icon={ROLE_WORDS[row.role].icon} size={14} color="var(--sd-paper-ink)" />
                  {row.callSign}
                </span>
              )}
            </span>
            <span className="td-key">
              <span className="td-when">{w.when}</span>
              <span className="td-call">{w.call}</span>
            </span>
            <span className="td-effect">{effect}</span>
            <span className={`td-stamp ${row.verdict}`}>{w.stamp}</span>
          </>
        )}
      </li>
    );
  });

  const kicker = [W.crew(f.num(seats)), ...(objective ? [W.objective(objective)] : [])].join(' · ');
  const decided = W.decisions(f.num(report.votes.total), report.votes.total === 1);

  if (phone)
    return (
      <section className="td phone" aria-label={W.label}>
        <div className="td-head">
          <span className="td-head-l">
            <span className="td-kicker">{kicker}</span>
            <h2 className="td-title">{W.title}</h2>
          </span>
          <span className="td-score-mini" aria-label={`${W.score} ${f.num(report.score)} ${W.outOfShort(f.num(report.max))}`}>
            <span className="td-score-v">{f.num(report.score)}</span>
            <span className="td-score-of">{W.outOfShort(f.num(report.max))}</span>
          </span>
        </div>
        <div className="td-parts-mini">
          {report.parts.map((p) => (
            <span key={p.id} className="td-part-mini">
              <span className="td-part-k">{W.partsShort[p.id]}</span>
              <span className="td-part-v">{partShort(p.id, p.n, p.of)}</span>
            </span>
          ))}
        </div>
        <ul className="td-rows">{rows}</ul>
        <span className="td-note">{W.note}</span>
        <button type="button" className="td-next" onClick={onNext}>
          {W.next}
        </button>
      </section>
    );

  return (
    <section className="td" aria-label={W.label}>
      <div className="td-main">
        <div className="td-head">
          <span className="td-head-l">
            {back}
            <span className="td-kicker">{kicker}</span>
            <h2 className="td-title">{W.title}</h2>
          </span>
          <span className="td-decided">{decided}</span>
        </div>
        <div className="td-cols" aria-hidden="true">
          <span />
          <span>{W.cols.role}</span>
          <span>{W.cols.key}</span>
          <span>{W.cols.effect}</span>
          <span className="r">{W.cols.verdict}</span>
        </div>
        <ul className="td-rows">{rows}</ul>
      </div>
      <div className="td-side">
        <div className="td-score" role="group" aria-label={W.score}>
          <span className="td-score-k">{W.score}</span>
          <span className="td-score-big">
            <span className="td-score-v">{f.num(report.score)}</span>
            <span className="td-score-of">{W.outOf(f.num(report.max))}</span>
          </span>
          {report.parts.map((p) => (
            <div key={p.id} className="td-part">
              <div className="td-part-head">
                <span className="td-part-k">{W.parts[p.id]}</span>
                <span className="td-part-pts">{W.points(f.num(p.points))}</span>
              </div>
              <div className="td-pips">
                {(p.of ? Array.from({ length: p.of }, (_, i) => i < p.n) : [true]).map((on, i) => (
                  <span key={i} className={`td-pip${on ? ' on' : ''}`} />
                ))}
              </div>
              <span className="td-part-v">{partLine(p.id, p.n, p.of)}</span>
            </div>
          ))}
        </div>
        <span className="td-note">{W.note}</span>
        <button type="button" className="td-next" onClick={onNext}>
          {W.next} ▸
        </button>
      </div>
    </section>
  );
}
