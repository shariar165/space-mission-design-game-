// FINAL TRANSMISSION (Mission Report design, TELETYPE 03): before the report, the robot's last message comes off the
// teletype line by line (engine finalTransmission; words sdWords FINAL_WORDS). A lost robot's last line breaks off
// mid-word and SIGNAL LOST follows; an extended one ends STILL HERE. FEED THE PAPER moves on to the report.
import { useEffect, type ReactNode } from 'react';
import type { FinalTransmission as Final } from '../../../engine/ops/report';
import { VOICE_RULES } from '../../../engine/ops/index';
import * as f from '../../format';
import { fill, FINAL_WORDS, FLY_WORDS } from '../../sdWords';
import { SourceInfo } from '../SourceInfo';
import { useTeletype } from '../sd/Teletype';

interface Props {
  ft: Final;
  /** The lines in words (sdWords finalLines). */
  lines: string[];
  name: string;
  phone: boolean;
  /** ◂ BACK, at the top of the first sheet. */
  back?: ReactNode;
  /** The last line has printed (the comic may start). */
  onPrinted: () => void;
  /** FEED THE PAPER: on to the report. */
  onFeed: () => void;
}

export function FinalTransmission({ ft, lines, name, phone, back, onPrinted, onFeed }: Props) {
  const all = lines.join('\n');
  const shown = useTeletype(all);
  const done = shown === all;
  const still = useTeletype(done && ft.ending === 'extended' ? FINAL_WORDS.still : '', 'slow');
  useEffect(() => {
    if (done) onPrinted();
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  const printed = shown.split('\n');
  const delay = FLY_WORDS.duration(ft.delay_s);
  const kicker = `${FINAL_WORDS.kicker(f.dayPad(ft.receivedAt))}${ft.ending === 'lost' ? ` · ${FINAL_WORDS.incomplete}` : ''}`;

  return (
    <section className={`ft ${ft.ending}`} aria-label={FINAL_WORDS.label}>
      {back}
      <header className="ft-head">
        <div className="ft-meta">
          <span>{kicker}</span>
          {!phone && <span>{FINAL_WORDS.sent(delay)}</span>}
        </div>
        <h2 className="ft-title">{FINAL_WORDS.title(name.toUpperCase())}</h2>
        {phone && <span className="ft-meta">{FINAL_WORDS.sent(delay)}</span>}
      </header>
      <div className="ft-body">
        <p className="sr-only">{lines.join(' ')}</p>
        {lines.map((l, i) => {
          const text = printed[i] ?? '';
          const typing = !done && i === printed.length - 1;
          const tail = done && i === lines.length - 1 && ft.ending === 'complete';
          return (
            <div key={i} className="ft-line" aria-hidden="true">
              {text}
              {(typing || tail) && <span className="sd-cursor">█</span>}
            </div>
          );
        })}
        {done && ft.ending === 'lost' && (
          <div className="ft-lost" role="status">
            <span className="ft-rule" />
            <span className="ft-lost-word">{FINAL_WORDS.lost}</span>
            <SourceInfo s={VOICE_RULES.lastWordsHistory} title="Opportunity’s last message" />
            <span className="ft-rule" />
          </div>
        )}
        {done && ft.ending === 'extended' && (
          <div className="ft-still" aria-label={FINAL_WORDS.still}>
            {still}
            <span className="sd-cursor">█</span>
          </div>
        )}
      </div>
      <footer className="ft-foot">
        <span className="ft-foot-t">{fill(FINAL_WORDS.foot[ft.ending], { delay: delay.toLowerCase() })}</span>
        <button type="button" className="ft-feed" onClick={onFeed}>
          {FINAL_WORDS.feed}
        </button>
      </footer>
    </section>
  );
}
