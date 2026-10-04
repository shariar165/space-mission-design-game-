// Level goal (Review screen) and level result (top of the Debrief) for Cadet levels.
// The Jupiter lesson is a Sourced fact (lessons.json) with its ⓘ.
import { DESTINATIONS, LESSONS } from '../../engine/data';
import { maxStars, nextLevel, type Level } from '../levels';
import { SourceInfo } from './SourceInfo';
import { Star } from './icons';

export function LevelGoal({ level, stars, onMap }: { level: Level; stars: number; onMap: () => void }) {
  const name = DESTINATIONS[level.destination].name.replace(/ \(.*\)$/, '');
  const dest = level.destination === 'moon' ? 'the Moon' : name;
  if (level.impossible) {
    const lesson = LESSONS[level.destination];
    return (
      <div className="goal">
        <div className="goal-head">🎯 {level.title}</div>
        {stars > 0 && lesson ? (
          <div className="lesson" role="status">
            <div className="lesson-head">
              <Star filled size={22} /> Lesson learned: {lesson.title}
              <SourceInfo s={lesson.lesson} title="Juno's real route" />
            </div>
            <p>{lesson.lesson.value}</p>
            <button type="button" className="btn-big" onClick={onMap}>
              Back to the map
            </button>
          </div>
        ) : (
          <p className="goal-line">Find out why no rocket can send this craft to {dest}. Run a Test Flight.</p>
        )}
      </div>
    );
  }
  return (
    <div className="goal">
      <div className="goal-head">🎯 {level.title}: earn your stars</div>
      <ul className="goal-stars">
        <li>
          <Star filled={stars >= 1} size={18} /> Reach {dest} and start science
        </li>
        <li>
          <Star filled={stars >= 2} size={18} /> Send home most of your photos
        </li>
        <li>
          <Star filled={stars >= 3} size={18} /> End with every gauge in the safe zone: not too tight, not too roomy
        </li>
      </ul>
    </div>
  );
}

export function LevelBanner({ level, stars, onPlay, onMap, onRetry }: { level: Level; stars: number; onPlay: (l: Level) => void; onMap: () => void; onRetry: () => void }) {
  const next = nextLevel(level.id);
  const passed = stars > 0;
  return (
    <section className={`level-banner${passed ? ' passed' : ''}`} aria-label="Level result">
      <div>
        <div className="ckicker">{level.title}</div>
        <div className="lb-title">{passed ? 'Level complete!' : 'Not this time. Try again!'}</div>
      </div>
      <div className="lb-stars" aria-label={`${stars} of ${maxStars(level)} stars`}>
        {Array.from({ length: maxStars(level) }, (_, k) => (
          <Star key={k} filled={k < stars} size={34} />
        ))}
      </div>
      <div className="lb-actions">
        <button type="button" className="btn-big ghost" onClick={onMap}>
          Map
        </button>
        <button type="button" className={`btn-big${passed ? ' ghost' : ''}`} onClick={onRetry}>
          Try again
        </button>
        {passed && next && (
          <button type="button" className="btn-big" onClick={() => onPlay(next)}>
            Next: {next.title} →
          </button>
        )}
      </div>
    </section>
  );
}
