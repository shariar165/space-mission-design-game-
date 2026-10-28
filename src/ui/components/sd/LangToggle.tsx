// EN / বাংলা: the language of the words on screen (lang.ts), saved in the browser. Numbers stay the same.
import { setLang, useLang } from '../../lang';
import { LANG_WORDS } from '../../sdWords';

export function LangToggle({ className = '' }: { className?: string }) {
  const lang = useLang();
  const other = lang === 'en' ? 'bn' : 'en';
  return (
    <button
      type="button"
      className={`sd-ghost-btn sd-lang ${className}`}
      aria-label={`${LANG_WORDS.label}: ${LANG_WORDS[lang]} → ${LANG_WORDS[other]}`}
      title={LANG_WORDS.label}
      onClick={() => setLang(other)}
    >
      <span className={lang === 'en' ? 'on' : ''} lang="en">
        {LANG_WORDS.en}
      </span>
      <span className="sd-lang-bar" aria-hidden="true">
        /
      </span>
      <span className={lang === 'bn' ? 'on' : ''} lang="bn">
        {LANG_WORDS.bn}
      </span>
    </button>
  );
}
