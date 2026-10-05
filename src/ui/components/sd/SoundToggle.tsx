// Sound on/off (saved in the browser). The cues themselves are in sound.ts.
import { useSoundOn } from '../../sound';
import { SOUND_WORDS } from '../../sdWords';

export function SoundToggle({ className = '' }: { className?: string }) {
  const [on, setOn] = useSoundOn();
  return (
    <button type="button" className={`sd-ghost-btn sd-sound ${className}`} aria-pressed={on} aria-label={on ? SOUND_WORDS.on : SOUND_WORDS.off} title={on ? SOUND_WORDS.on : SOUND_WORDS.off} onClick={() => setOn(!on)}>
      {on ? '🔊' : '🔇'}
    </button>
  );
}
