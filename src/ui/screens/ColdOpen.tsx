// COLD OPEN (spec UI rule 47): the first launch opens on black with a teletype. Mars Climate Orbiter, Sept. 23, 1999:
// the orbit insertion burn, the signal everyone waited for, NO SIGNAL, the units, and what it means for the player.
// About 15 s; SKIP is always there; Home's second row replays it. Every fact is the MCO rescue case's (engine
// coldOpenFacts); words in sdWords (COLD_OPEN). The teletype clacks while it types and static fills the wait
// (sound.ts, after the player's first click or key). Reduced motion prints each line whole and keeps every pause short.
import { useEffect, useMemo, useRef, useState } from 'react';
import { coldOpenFacts } from '../../engine/rescue';
import { SoundToggle } from '../components/sd/SoundToggle';
import { useTeletype } from '../components/sd/Teletype';
import * as f from '../format';
import { useReducedMotion } from '../opsGeometry';
import { COLD_OPEN } from '../sdWords';
import { useLoop } from '../sound';

/** How long each beat stays once it has printed (ms): about 15 s in all with the typing. */
export const COLD_OPEN_HOLD_MS = { burn: 800, expected: 500, wait: 3000, lost: 1400, units: 1000, moral: 1700 } as const;
/** Reduced motion: every beat (the wait too) holds this long, so the whole open takes under 4 s. */
export const COLD_OPEN_STILL_MS = 600;

type Beat = keyof typeof COLD_OPEN_HOLD_MS;
const BEATS = Object.keys(COLD_OPEN_HOLD_MS) as Beat[];
/** The second screen starts here: the first is cleared away. */
const SECOND = BEATS.indexOf('units');

/** The line being printed: it reports when the last character is down. */
function Typing({ text, className, onTyped }: { text: string; className: string; onTyped: () => void }) {
  const shown = useTeletype(text);
  const done = shown === text;
  useEffect(() => {
    if (done) onTyped();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <p className={className}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {shown}
        <span className="sd-cursor">█</span>
      </span>
    </p>
  );
}

interface Props {
  /** The open has ended, or SKIP. */
  onDone: () => void;
}

export function ColdOpen({ onDone }: Props) {
  const still = useReducedMotion();
  const facts = useMemo(coldOpenFacts, []);
  const [beat, setBeat] = useState(0);
  /** The last beat whose line is fully printed. */
  const [printed, setPrinted] = useState(-1);
  const ended = useRef(false);
  const end = () => {
    if (ended.current) return;
    ended.current = true;
    onDone();
  };
  const id = BEATS[beat]!;
  const ready = id === 'wait' || printed >= beat;
  const last = beat === BEATS.length - 1;
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => (last ? end() : setBeat(beat + 1)), still ? COLD_OPEN_STILL_MS : COLD_OPEN_HOLD_MS[id]);
    return () => clearTimeout(t);
  }, [ready, beat, still]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && end();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // The long wait for a signal that never comes: radio static.
  useLoop('static', id === 'wait');

  const words: Record<Exclude<Beat, 'wait'>, string> = {
    burn: COLD_OPEN.burn(f.longDate(facts.arrival.value), facts.craft),
    expected: COLD_OPEN.expected,
    lost: COLD_OPEN.lost,
    units: COLD_OPEN.units,
    moral: COLD_OPEN.moral,
  };
  const line = (b: Exclude<Beat, 'wait'>) => {
    const i = BEATS.indexOf(b);
    if (i > beat) return null;
    const cls = `co-line ${b}`;
    return i === beat ? <Typing key={b} text={words[b]} className={cls} onTyped={() => setPrinted(i)} /> : (
      <p key={b} className={cls}>
        {words[b]}
      </p>
    );
  };
  const waitAt = BEATS.indexOf('wait');

  return (
    <div className={`sd co${still ? ' still' : ''}`}>
      <div className="co-keys">
        <SoundToggle />
        <button type="button" className="sd-ghost-btn co-skip" onClick={end}>
          {COLD_OPEN.skip}
        </button>
      </div>
      <main className={`co-screen${beat >= SECOND ? ' second' : ''}`} aria-label={COLD_OPEN.label} data-beat={id}>
        {beat < SECOND ? (
          <>
            {line('burn')}
            {line('expected')}
            {beat >= waitAt && (
              <div className={`co-wait${beat > waitAt ? ' over' : ''}`}>
                <span className="co-wait-k">{COLD_OPEN.waiting}</span>
                <span className="co-trace" aria-hidden="true" />
              </div>
            )}
            {line('lost')}
          </>
        ) : (
          <>
            {line('units')}
            {line('moral')}
            <p className="co-source">{COLD_OPEN.source(facts.citation)}</p>
          </>
        )}
      </main>
    </div>
  );
}
