// ENGINEER'S NOTEBOOK (Signal Delay design, screen 06). Every mission earns real lessons from real spaceflight;
// locked cards say how to earn them. The lessons and their open state come from the engine (notebook.ts); each
// real history is a Sourced text with its ⓘ and "to verify" badge.
import { useState } from 'react';
import { HAZARDS } from '../../engine/data';
import { lessonText, notebook, NOTEBOOK, type LessonCategory, type NotebookFacts } from '../../engine/notebook';
import { rescueCase, type RescueCaseId } from '../../engine/rescue';
import { SourceInfo } from '../components/SourceInfo';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon, type SDIconName } from '../components/sd/SDIcon';
import { useIsPhone } from '../sdGeometry';
import { levelById } from '../levels';
import { CATEGORY_LOOK, dangerLook, LESSON_WORDS, unlockHint } from '../sdWords';
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
}

export function Notebook({ facts, fresh, mode, onMode, onHome }: Props) {
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
      ? `MISSION DAY ${f.num(card.day)}`
      : card.unlock.kind === 'finish-level'
        ? ctx.level(card.unlock.id).toUpperCase()
        : card.unlock.kind === 'solve-rescue'
          ? `RESCUE HISTORY · ${ctx.rescue(card.unlock.id).toUpperCase()}`
          : 'A FLIGHT';

  const detail = (
    <>
      <div className="nb-band" style={{ background: look.color }} />
      <div className="nb-detail-body">
        <div className="nb-detail-top">
          <span className="nb-detail-k">
            LESSON {pad2(card.num)} · {look.name}
          </span>
          {phone ? (
            <button type="button" className="nb-close" aria-label="Close lesson" onClick={() => setSheet(false)}>
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
                REAL HISTORY
                {text.isGameEstimate && <span className="sd-verify">TO VERIFY</span>}
                <SourceInfo s={text} title={words.title.toLowerCase()} />
              </span>
              <span className="sd-history-v">{text.value}</span>
            </div>
            {engineer && (
              <div className="nb-numbers">
                <span className="nb-numbers-k">THE SOURCE</span>
                <span className="nb-numbers-v">{text.source}</span>
              </div>
            )}
            <span className="nb-earned">EARNED · {earned}</span>
          </>
        ) : (
          <>
            <h2 className="nb-detail-title locked">LOCKED</h2>
            <p className="nb-detail-text">{unlockHint(card.unlock, ctx)} to earn this lesson.</p>
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
            <button type="button" className="nb-home" onClick={onHome}>
              ◂ HOME
            </button>
            <h1 className="nb-title">{phone ? 'NOTEBOOK' : 'ENGINEER’S NOTEBOOK'}</h1>
            <span className="nb-count">
              {f.num(got)} OF {f.num(NOTEBOOK.length)} COLLECTED
            </span>
          </div>
          <div className="nb-head-r">
            <div className="nb-cats" role="group" aria-label="Categories">
              {CATS.map((c) => (
                <button key={c} type="button" className="nb-cat" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                  <span className="nb-cat-dot" style={{ background: c === 'all' ? 'var(--sd-paper)' : CATEGORY_LOOK[c].color }} />
                  {c === 'all' ? 'ALL' : CATEGORY_LOOK[c].name}
                </button>
              ))}
            </div>
            <ModeLever mode={mode} onMode={onMode} />
          </div>
        </div>
        <div className="nb-main">
          <div className="nb-grid" role="group" aria-label="Lessons">
            {cards.map((c, i) => {
              const dim = filter !== 'all' && c.category !== filter;
              const w = LESSON_WORDS[c.id];
              return (
                <button
                  key={c.id}
                  type="button"
                  className={`nb-card${c.open ? '' : ' locked'}${i === sel ? ' on' : ''}${dim ? ' dim' : ''}`}
                  aria-label={c.open ? `Lesson ${f.num(c.num)}: ${w?.title ?? c.id}` : `Lesson ${f.num(c.num)}: locked. ${unlockHint(c.unlock, ctx)}`}
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
                    {!phone && <span className="nb-card-sub">{c.open ? CATEGORY_LOOK[c.category].name : 'LOCKED'}</span>}
                  </span>
                  {fresh.includes(c.id) && <span className="nb-new">NEW</span>}
                </button>
              );
            })}
          </div>
          {!phone && <section className="nb-detail" aria-label="Lesson">{detail}</section>}
        </div>
      </div>
      {phone && sheet && (
        <>
          <div className="nb-scrim" onClick={() => setSheet(false)} />
          <section className="nb-detail sheet" aria-label="Lesson" role="dialog">
            {detail}
          </section>
        </>
      )}
    </div>
  );
}
