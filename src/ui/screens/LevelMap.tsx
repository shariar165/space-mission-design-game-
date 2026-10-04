// Level map: a winding trail of planets. Each node teaches one idea, shows its stars, and opens when the
// level before it has a star. Rescue History sits beside the trail.
import { DESTINATIONS } from '../../engine/data';
import { Star } from '../components/icons';
import * as f from '../format';
import { isUnlocked, LEVELS, maxStars, type Level, type Progress } from '../levels';

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
          <div className="ckicker">Mission map</div>
          <h1 className="ctitle">Where will you fly next?</h1>
          <p className="chelper">Each mission teaches one new idea. Earn a star to open the next one.</p>
        </div>
        <div className="lm-total" aria-label="Stars earned">
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
          return (
            <li key={l.id} className={`node ${l.destination}${open ? '' : ' locked'}${i === current ? ' next' : ''}`}>
              <button type="button" className="node-btn" disabled={!open} onClick={() => onPlay(l)} aria-label={`${l.title}: ${DESTINATIONS[l.destination].name}, learn ${l.concept}${open ? '' : ' (locked)'}`}>
                <span className={`planet p-${l.destination}`} aria-hidden="true">
                  {!open && <span className="lock">🔒</span>}
                  {i === current && <span className="you-are-here">▶</span>}
                </span>
                <span className="node-text">
                  <span className="node-dest">{DESTINATIONS[l.destination].name.replace(/ \(.*\)$/, '')}</span>
                  <span className="node-title">{l.title}</span>
                  <span className="node-concept">Learn: {l.concept}</span>
                  <span className="node-stars" aria-label={`${f.num(stars)} of ${f.num(maxStars(l))} stars`}>
                    {Array.from({ length: maxStars(l) }, (_, k) => (
                      <Star key={k} filled={k < stars} size={18} />
                    ))}
                  </span>
                </span>
              </button>
              <p className="node-blurb">{l.blurb}</p>
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
            <span className="node-title">Rescue History</span>
            <span className="node-concept">Find the bug in a real lost mission, before it launches.</span>
          </span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  );
}
