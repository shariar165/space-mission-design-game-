// The player's crew file: rank (a real Mission Control job, engine rankFor) and badges (engine badges). The plate
// sits on Home; it opens a panel with the real job behind the rank and how to earn every badge.
import { useState } from 'react';
import type { BadgeDef, RankDef } from '../../../engine/ranks';
import { SourceInfo } from '../SourceInfo';
import { BADGE_WORDS, CREW_WORDS, RANK_WORDS } from '../../sdWords';
import { SDIcon, type SDIconName } from './SDIcon';

export interface Crew {
  rank: RankDef;
  next?: RankDef;
  starsToNext?: number;
  stars: number;
  maxStars: number;
  badges: (BadgeDef & { earned: boolean })[];
}

const rankName = (r: RankDef) => RANK_WORDS[r.id] ?? r.id.toUpperCase();

export function CrewPlate({ crew, className = '' }: { crew: Crew; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={`crew-plate ${className}`} onClick={() => setOpen(true)} aria-label={`${CREW_WORDS.open}: ${rankName(crew.rank)}`}>
        <span className="crew-medal">
          <SDIcon icon="medal" size={22} color="var(--sd-gold)" />
        </span>
        <span className="crew-text">
          <span className="crew-rank">{rankName(crew.rank)}</span>
          <span className="crew-next">{crew.next && crew.starsToNext !== undefined ? CREW_WORDS.toNext(crew.starsToNext, rankName(crew.next)) : CREW_WORDS.top}</span>
        </span>
        <span className="crew-dots" aria-hidden="true">
          {crew.badges.map((b) => (
            <span key={b.id} className={b.earned ? 'on' : ''} />
          ))}
        </span>
      </button>
      {open && <CrewPanel crew={crew} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CrewPanel({ crew, onClose }: { crew: Crew; onClose: () => void }) {
  return (
    <div className="sd-overlay" role="dialog" aria-modal="true" aria-label={CREW_WORDS.title}>
      <div className="crew-panel sd-paper">
        <span className="crew-k">{CREW_WORDS.title}</span>
        <div className="crew-head">
          <SDIcon icon="medal" size={40} color="var(--sd-red)" />
          <div>
            <span className="crew-k">{CREW_WORDS.rank}</span>
            <h2 className="crew-title">{rankName(crew.rank)}</h2>
            <span className="crew-sub">
              {CREW_WORDS.stars(crew.stars, crew.maxStars)}
              {crew.next && crew.starsToNext !== undefined ? ` · ${CREW_WORDS.toNext(crew.starsToNext, rankName(crew.next))}` : ''}
            </span>
          </div>
        </div>
        <p className="crew-job">
          <span className="crew-k">
            {CREW_WORDS.realJob}
            {crew.rank.job.isGameEstimate && <span className="sd-verify">TO VERIFY</span>}
            <SourceInfo s={crew.rank.job} title={rankName(crew.rank)} />
          </span>
          {crew.rank.job.value}
        </p>
        <span className="crew-k">{CREW_WORDS.badges}</span>
        <ul className="crew-badges">
          {crew.badges.map((b) => {
            const w = BADGE_WORDS[b.id] ?? { name: b.id.toUpperCase(), how: '' };
            return (
              <li key={b.id} className={b.earned ? 'on' : ''} aria-label={`${w.name}: ${b.earned ? CREW_WORDS.earned : CREW_WORDS.locked}`}>
                <span className="crew-badge-icon">
                  <SDIcon icon={b.icon as SDIconName} size={22} color={b.earned ? 'var(--sd-paper)' : 'var(--sd-ink-3)'} />
                </span>
                <span className="crew-badge-name">{w.name}</span>
                <span className="crew-badge-how">{w.how}</span>
              </li>
            );
          })}
        </ul>
        <button type="button" className="sd-cta crew-close" onClick={onClose}>
          {CREW_WORDS.close}
        </button>
      </div>
    </div>
  );
}
