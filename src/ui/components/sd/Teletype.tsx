// Teletype text: characters appear one by one behind a blinking block cursor (design: CRT log line, INCOMING
// result, Home pitch). Screen readers get the whole line at once; reduced motion shows it whole.
import { useEffect, useState } from 'react';
import { useReducedMotion } from '../../opsGeometry';

/** One step every 33 ms; each step schedules the next. */
export const TELETYPE_TICK_MS = 33;
export type TypeSpeed = 'slow' | 'normal' | 'fast';
/** Characters per second, as the design's typeSpeed prop. */
const CPS: Record<TypeSpeed, number> = { slow: 18, normal: 34, fast: 70 };

/** How much of `text` is shown, restarting whenever the text changes. */
export function useTeletype(text: string, speed: TypeSpeed = 'normal'): string {
  const still = useReducedMotion();
  const [shown, setShown] = useState(0);
  useEffect(() => setShown(0), [text]);
  useEffect(() => {
    if (still || shown >= text.length) return;
    const id = setTimeout(() => setShown((n) => Math.min(text.length, n + Math.max(1, Math.round((CPS[speed] * TELETYPE_TICK_MS) / 1000)))), TELETYPE_TICK_MS);
    return () => clearTimeout(id);
  }, [still, shown, text, speed]);
  return still ? text : text.slice(0, shown);
}

interface Props {
  text: string;
  speed?: TypeSpeed;
  className?: string;
  prefix?: string;
  as?: 'div' | 'p' | 'span';
}

export function Teletype({ text, speed, className, prefix = '', as: Tag = 'div' }: Props) {
  const shown = useTeletype(text, speed);
  return (
    <Tag className={className}>
      <span className="sr-only">{prefix + text}</span>
      <span aria-hidden="true">
        {prefix}
        {shown}
        <span className="sd-cursor">█</span>
      </span>
    </Tag>
  );
}
