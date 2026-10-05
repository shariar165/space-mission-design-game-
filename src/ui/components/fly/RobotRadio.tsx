// The robot's radio bubble on the flight map: its latest message, in its own words, and how long the message took
// to cross space (engine: heardMessages, the one-way light time). It shows for a while after each new message.
import { useEffect, useState } from 'react';
import type { RobotMessage } from '../../../engine/ops/index';
import * as f from '../../format';
import { ROBOT_WORDS, robotSays } from '../../sdWords';

/** How long a new message stays on screen (ms, real time). */
export const RADIO_SHOW_MS = 9000;

export function RobotRadio({ message, name, destName, hidden }: { message?: RobotMessage; name: string; destName: string; hidden?: boolean }) {
  const key = message ? `${message.kind}:${message.sentAt}` : '';
  const [shown, setShown] = useState<string>();
  useEffect(() => {
    if (!key) return;
    setShown(key);
    const id = setTimeout(() => setShown((k) => (k === key ? undefined : k)), RADIO_SHOW_MS);
    return () => clearTimeout(id);
  }, [key]);
  if (!message || shown !== key || hidden) return null;
  const bad = message.kind === 'hit' || message.kind === 'hurt' || message.kind === 'last-words' || message.kind === 'brownout' || message.kind === 'instrument-lost' || message.kind === 'launch-failed';
  return (
    <div className={`fly-radio${bad ? ' bad' : ''}`} role="log" aria-label={ROBOT_WORDS.radio(name)}>
      <span className="fly-radio-k">📡 {ROBOT_WORDS.radio(name)}</span>
      <span className="fly-radio-v">“{robotSays(message, destName)}”</span>
      <span className="fly-radio-t">{ROBOT_WORDS.took(destName.toUpperCase(), f.durationWords(message.delay_s))}</span>
    </div>
  );
}
