// Level map: a winding trail of planets. Each node teaches one idea, shows its stars, and opens when the
// level before it has a star. Rescue History sits beside the trail.
import { DESTINATIONS } from '../../engine/data';
import { Star } from '../components/icons';
import * as f from '../format';
import { isUnlocked, LEVELS, maxStars, type Level, type Progress } from '../levels';
import { LEVEL_MAP_WORDS, LEVEL_WORDS } from '../sdWords';

interface Props {
  progress: Progress;
  onPlay: (l: Level) => void;
  onRescue?: () => void;
}

export function LevelMap({ progress, onPlay, onRescue }: Props) {
  const earned = LEVELS.reduce((s, l) => s + (progress[l.id] ?? 0), 0);
  const possible = LEVELS.reduce((s, l) => s + maxStars(l), 0);
  const current = LEVELS.findIndex((l, i) => isUnlocked(i, progress) && !(progress[l.id] ?? 0));
  return (
    <div className="cadet levelmap">
      <header className="lm-head">
        <div>
          <div className="ckicker">{LEVEL_MAP_WORDS.kicker}</div>
          <h1 className="ctitle">{LEVEL_MAP_WORDS.title}</h1>
          <p className="chelper">{LEVEL_MAP_WORDS.helper}</p>
        </div>
        <div className="lm-total" aria-label={LEVEL_MAP_WORDS.total}>
          <Star filled size={28} />
          <span className="mono">
            {f.num(earned)}
            <span className="faint"> / {f.num(possible)}</span>
          </span>
        </div>
      </header>

      <ol className="trail">
        {LEVELS.map((l, i) => {
          const open = isUnlocked(i, progress);
          const stars = progress[l.id] ?? 0;
          const dest = LEVEL_MAP_WORDS.dest(DESTINATIONS[l.destination].name);
          const teaches = LEVEL_WORDS.teaches[l.id] ?? '';
          return (
            <li key={l.id} className={`node ${l.destination}${open ? '' : ' locked'}${i === current ? ' next' : ''}`}>
              <button type="button" className="node-btn" disabled={!open} onClick={() => onPlay(l)} aria-label={LEVEL_MAP_WORDS.node(l.title, dest, teaches, open)}>
                <span className={`planet p-${l.destination}`} aria-hidden="true">
                  {!open && <span className="lock">🔒</span>}
                  {i === current && <span className="you-are-here">▶</span>}
                </span>
                <span className="node-text">
                  <span className="node-dest">{dest}</span>
                  <span className="node-title">{l.title}</span>
                  <span className="node-concept">{LEVEL_MAP_WORDS.learn(teaches)}</span>
                  <span className="node-stars" aria-label={LEVEL_MAP_WORDS.stars(f.num(stars), f.num(maxStars(l)))}>
                    {Array.from({ length: maxStars(l) }, (_, k) => (
                      <Star key={k} filled={k < stars} size={18} />
                    ))}
                  </span>
                </span>
              </button>
              <p className="node-blurb">{LEVEL_WORDS.blurb[l.id]}</p>
            </li>
          );
        })}
      </ol>

      {onRescue && (
        <button type="button" className="rescue-entry" onClick={onRescue}>
          <span className="rescue-icon" aria-hidden="true">
            🛟
          </span>
          <span>
            <span className="node-title">{LEVEL_MAP_WORDS.rescue}</span>
            <span className="node-concept">{LEVEL_MAP_WORDS.rescueSub}</span>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
