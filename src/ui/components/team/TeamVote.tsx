// Team Fly (spec: Team mode; design: Signal Delay - Team Play.dc.html, T4). WHOSE DECISION: the three steps of a
// danger card's vote (the related role recommends, every other role votes, the Flight Director makes the final call),
// and the FINAL CALL box that says which way the team leans. Where the vote stands comes from the engine
// (team/fly.ts cardVote); the words from sdWords (TEAM_FLY_WORDS, ROLE_WORDS).
import type { CardVoteView } from '../../../engine/team/fly';
import type { RoleId } from '../../../engine/team/roles';
import * as f from '../../format';
import { ROLE_WORDS, TEAM_FLY_WORDS } from '../../sdWords';
import { SDIcon } from '../sd/SDIcon';

const STEPS = ['recommend', 'vote', 'call'] as const;

/** The option's letter on the cards (A, B, C). */
export const letterOf = (options: readonly string[], id: string): string => TEAM_FLY_WORDS.letters[options.indexOf(id)] ?? id;

export function VoteStrip({ view, phone }: { view: CardVoteView; phone: boolean }) {
  const at = view.stage === 'settled' ? 3 : STEPS.indexOf(view.stage);
  const who = (step: (typeof STEPS)[number]): { role: RoleId; text: string } => {
    if (step === 'recommend') return { role: view.recommender.role, text: phone ? ROLE_WORDS[view.recommender.role].ab : ROLE_WORDS[view.recommender.role].name };
    if (step === 'vote') return { role: 'comms-ops', text: phone ? TEAM_FLY_WORDS.allShort : TEAM_FLY_WORDS.allRoles };
    return { role: 'flight-director', text: phone ? ROLE_WORDS['flight-director'].ab : ROLE_WORDS['flight-director'].name };
  };
  const steps = view.solo ? STEPS.slice(0, 1) : STEPS;
  return (
    <div className={`tf-strip${phone ? ' phone' : ''}`} role="group" aria-label={TEAM_FLY_WORDS.whose}>
      {!phone && <span className="tm-label tf-strip-k">{TEAM_FLY_WORDS.whose}</span>}
      <ol className="tf-steps">
        {steps.map((step, i) => {
          const w = who(step);
          const state = i < at ? 'done' : i === at ? 'on' : 'next';
          return (
            <li key={step} className={`tf-step ${state} tm-r-${w.role}${step === 'vote' ? ' all' : ''}`} {...(state === 'on' ? { 'aria-current': 'step' as const } : {})}>
              <span className="tf-step-dot">{!phone && <SDIcon icon={step === 'vote' ? 'check' : ROLE_WORDS[w.role].icon} size={16} color={state === 'on' ? 'var(--sd-paper-ink)' : 'currentColor'} />}</span>
              <span className="tf-step-text">
                <span className="tf-step-k">{phone ? TEAM_FLY_WORDS.stages[step] : TEAM_FLY_WORDS.stage(f.num(i + 1), TEAM_FLY_WORDS.stages[step])}</span>
                <span className="tf-step-v">{w.text}</span>
              </span>
            </li>
          );
        })}
      </ol>
      {!phone && <span className="tf-held">{TEAM_FLY_WORDS.clockHeld}</span>}
    </div>
  );
}

/** FINAL CALL: the Flight Director taps a card; the box says which way the team leans. */
export function FinalCall({ view, options, phone }: { view: CardVoteView; options: readonly string[]; phone: boolean }) {
  if (view.solo || view.stage === 'settled' || !view.director) return null;
  const line =
    view.stage === 'recommend'
      ? TEAM_FLY_WORDS.recommendNow(ROLE_WORDS[view.recommender.role].ab)
      : `${view.leans ? TEAM_FLY_WORDS.leans(letterOf(options, view.leans)) : TEAM_FLY_WORDS.noLean} · ${view.waiting > 0 ? TEAM_FLY_WORDS.waiting(f.num(view.waiting), view.waiting === 1) : TEAM_FLY_WORDS.tapCard}`;
  return (
    <div className={`tf-call${view.stage === 'recommend' ? ' wait' : ''}${phone ? ' phone' : ''}`} role="status">
      {!phone && <span className="tf-call-badge">{ROLE_WORDS['flight-director'].ab}</span>}
      <span className="tf-call-text">
        <span className="tf-call-title">{TEAM_FLY_WORDS.finalCall}</span>
        <span className="tf-call-line">{line}</span>
      </span>
    </div>
  );
}
