// The CADET / ENGINEER lever (design: top-right of every screen). Engineer shows the numbers and sources.
import { MODE_WORDS } from '../../sdWords';

export type Mode = 'cadet' | 'engineer';

interface Props {
  mode: Mode;
  onMode: (m: Mode) => void;
}

export function ModeLever({ mode, onMode }: Props) {
  const eng = mode === 'engineer';
  const flip = () => onMode(eng ? 'cadet' : 'engineer');
  return (
    <div className="sd-lever">
      <span className={`sd-lever-word${eng ? '' : ' on'}`} aria-hidden="true">
        {MODE_WORDS.cadet}
      </span>
      <button type="button" role="switch" aria-checked={eng} aria-label="Engineer mode" title="Engineer mode shows numbers and sources" className="sd-lever-switch" onClick={flip}>
        <span className="sd-lever-knob" />
      </button>
      <span className={`sd-lever-word${eng ? ' on' : ''}`} aria-hidden="true">
        {MODE_WORDS.engineer}
      </span>
      <button type="button" className="sd-lever-short" aria-pressed={eng} aria-label="Engineer mode (short)" onClick={flip}>
        {MODE_WORDS.short}
      </button>
    </div>
  );
}
