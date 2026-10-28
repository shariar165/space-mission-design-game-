// ENGINEER'S NOTEBOOK (Signal Delay design, screen 06). Every mission earns real lessons from real spaceflight;
// locked cards say how to earn them. The lessons and their open state come from the engine (notebook.ts); each
// real history is a Sourced text with its ⓘ and "to verify" badge.
import { useState } from 'react';
import { HAZARDS } from '../../engine/data';
import { lessonText, notebook, NOTEBOOK, type LessonCategory, type NotebookFacts } from '../../engine/notebook';
import { rescueCase, type RescueCaseId } from '../../engine/rescue';
import { SourceInfo } from '../components/SourceInfo';
import { BackButton } from '../components/sd/BackButton';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { LangToggle } from '../components/sd/LangToggle';
import { SoundToggle } from '../components/sd/SoundToggle';
import { SDIcon, type SDIconName } from '../components/sd/SDIcon';
import { useIsPhone } from '../sdGeometry';
import { levelById } from '../levels';
import { CATEGORY_LOOK, dangerLook, LESSON_WORDS, NOTEBOOK_WORDS, unlockHint } from '../sdWords';
import * as f from '../format';

const CATS: (LessonCategory | 'all')[] = ['all', 'signal', 'power', 'weather', 'nav', 'people'];
const pad2 = (n: number) => String(n).padStart(2, '0');

interface Props {
  facts: NotebookFacts;
  /** Lessons earned on the last flight (the NEW badge). */
  fresh: string[];
  mode: Mode;
  onMode: (m: Mode) => void;
  onHome: () => void;
  /** ◂ BACK to the previous screen (Home when there is none). */
  onBack?: () => void;
}

export function Notebook({ facts, fresh, mode, onMode, onHome, onBack }: Props) {
  const engineer = mode === 'engineer';
  const phone = useIsPhone();
  const cards = notebook(facts);
  const [filter, setFilter] = useState<LessonCategory | 'all'>('all');
  const [sel, setSel] = useState(() => Math.max(0, cards.findIndex((c) => c.open)));
  const [sheet, setSheet] = useState(false);
  const got = cards.filter((c) => c.open).length;
  const ctx = {
    level: (id: string) => levelById(id)?.title ?? id,
    rescue: (id: string) => rescueCase(id as RescueCaseId).title,
    hazard: (id: string) => dangerLook(id, HAZARDS[id]?.title ?? id).title,
  };
  const card = cards[sel] ?? cards[0]!;
  const text = lessonText(card);
  const words = LESSON_WORDS[card.id] ?? { title: card.id.toUpperCase(), body: '' };
  const look = CATEGORY_LOOK[card.category];

  const earned =
    card.day !== undefined
      ? NOTEBOOK_WORDS.missionDay(f.num(card.day))
      : card.unlock.kind === 'finish-level'
        ? ctx.level(card.unlock.id).toUpperCase()
        : card.unlock.kind === 'solve-rescue'
          ? NOTEBOOK_WORDS.rescue(ctx.rescue(card.unlock.id))
          : NOTEBOOK_WORDS.aFlight;

  const detail = (
    <>
      <div className="nb-band" style={{ background: look.color }} />
      <div className="nb-detail-body">
        <div className="nb-detail-top">
          <span className="nb-detail-k">{NOTEBOOK_WORDS.kicker(pad2(card.num), look.name)}</span>
          {phone ? (
            <button type="button" className="nb-close" aria-label={NOTEBOOK_WORDS.close} onClick={() => setSheet(false)}>
              <SDIcon icon="cross" size={16} color="var(--sd-paper-ink)" />
            </button>
          ) : (
            <span className="nb-detail-icon" style={{ background: look.color }}>
              <SDIcon icon={card.icon as SDIconName} size={28} color="var(--sd-paper-ink)" />
            </span>
          )}
        </div>
        {card.open ? (
          <>
            <h2 className="nb-detail-title">{words.title}</h2>
            <p className="nb-detail-text">{words.body}</p>
            <div className="sd-history">
              <span className="sd-history-k">
                {NOTEBOOK_WORDS.history}
                {text.isGameEstimate && <span className="sd-verify">{NOTEBOOK_WORDS.toVerify}</span>}
                <SourceInfo s={text} title={words.title.toLowerCase()} />
              </span>
              <span className="sd-history-v">{text.value}</span>
            </div>
            {engineer && (
              <div className="nb-numbers">
                <span className="nb-numbers-k">{NOTEBOOK_WORDS.source}</span>
                <span className="nb-numbers-v">{text.source}</span>
              </div>
            )}
            <span className="nb-earned">{NOTEBOOK_WORDS.earned(earned)}</span>
          </>
        ) : (
          <>
            <h2 className="nb-detail-title locked">{NOTEBOOK_WORDS.locked}</h2>
            <p className="nb-detail-text">{NOTEBOOK_WORDS.toEarn(unlockHint(card.unlock, ctx))}</p>
          </>
        )}
      </div>
    </>
  );

  return (
    <div className={`sd nb${phone ? ' phone' : ''}${engineer ? ' eng' : ''}`}>
      <div className="nb-frame">
        <div className="nb-head">
          <div className="nb-head-l">
            <BackButton onBack={onBack ?? onHome} />
            <h1 className="nb-title">{phone ? NOTEBOOK_WORDS.titleShort : NOTEBOOK_WORDS.title}</h1>
            <span className="nb-count">{NOTEBOOK_WORDS.collected(f.num(got), f.num(NOTEBOOK.length))}</span>
          </div>
          <div className="nb-head-r">
            <div className="nb-cats" role="group" aria-label={NOTEBOOK_WORDS.categories}>
              {CATS.map((c) => (
                <button key={c} type="button" className="nb-cat" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                  <span className="nb-cat-dot" style={{ background: c === 'all' ? 'var(--sd-paper)' : CATEGORY_LOOK[c].color }} />
                  {c === 'all' ? 'ALL' : CATEGORY_LOOK[c].name}
                </button>
              ))}
            </div>
            <span className="sd-top-keys">
              <LangToggle />
              <SoundToggle />
              <ModeLever mode={mode} onMode={onMode} />
            </span>
          </div>
        </div>
        <div className="nb-main">
          <div className="nb-grid" role="group" aria-label={NOTEBOOK_WORDS.lessons}>
            {cards.map((c, i) => {
              const dim = filter !== 'all' && c.category !== filter;
              const w = LESSON_WORDS[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`nb-card${c.open ? '' : ' locked'}${i === sel ? ' on' : ''}${dim ? ' dim' : ''}`}
                  aria-label={c.open ? NOTEBOOK_WORDS.lessonOf(f.num(c.num), w?.title ?? c.id) : NOTEBOOK_WORDS.lessonLocked(f.num(c.num), unlockHint(c.unlock, ctx))}
                  onClick={() => {
                    setSel(i);
                    if (phone) setSheet(true);
                  }}
                >
                  <span className="nb-card-band" style={{ background: c.open ? CATEGORY_LOOK[c.category].color : 'var(--sd-bezel)' }} />
                  <span className="nb-card-body">
                    <span className="nb-card-top">
                      <span className="nb-card-num">{pad2(c.num)}</span>
                      <SDIcon icon={(c.open ? c.icon : 'lock') as SDIconName} size={phone ? 20 : 26} color={c.open ? 'var(--sd-paper-ink)' : 'var(--sd-ink-6)'} />
                    </span>
                    <span className="nb-card-title">{c.open ? (w?.title ?? c.id) : unlockHint(c.unlock, ctx).toUpperCase()}</span>
                    {!phone && <span className="nb-card-sub">{c.open ? CATEGORY_LOOK[c.category].name : NOTEBOOK_WORDS.locked}</span>}
                  </span>
                  {fresh.includes(c.id) && <span className="nb-new">{NOTEBOOK_WORDS.fresh}</span>}
                </button>
              );
            })}
          </div>
          {!phone && <section className="nb-detail" aria-label={NOTEBOOK_WORDS.lesson}>{detail}</section>}
        </div>
      </div>
      {phone && sheet && (
        <>
          <div className="nb-scrim" onClick={() => setSheet(false)} />
          <section className="nb-detail sheet" aria-label={NOTEBOOK_WORDS.lesson} role="dialog">
            {detail}
          </section>
        </>
      )}
    </div>
  );
}
