// PACK (Signal Delay design, screen 02; spec UI rules, Pack). The rocket nose is a backpack: every part takes
// squares, and weight is a separate limit on the scale beside it. The Danger Deck shows what is coming, so you pack
// for it, then pick a green launch day, arm, and launch. Every number comes from the engine (pack.ts,
// evaluateDesign, cadetGauges); this screen only lays them out.
import { useEffect, useMemo, useState } from 'react';
import { cadetGauges } from '../../engine/cadet';
import { DESTINATIONS, HAZARDS, LESSONS } from '../../engine/data';
import { evaluateDesign } from '../../engine/index';
import {
  buildPackDesign,
  calendarTransfers,
  coversOf,
  dangerDeck,
  dayQuality,
  fitPart,
  footprint,
  initialPack,
  noseSquares,
  onDay,
  PACK,
  packBlockers,
  packPart,
  partsCovering,
  unpackPart,
  type CalendarDay,
  type Packed,
  type PartId,
} from '../../engine/pack';
import type { Design } from '../../engine/types';
import { SourceInfo } from '../components/SourceInfo';
import { MissionSteps } from '../components/sd/MissionSteps';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { useIsPhone } from '../sdGeometry';
import {
  DAY_WORDS,
  dangerLook,
  deckWhen,
  GAME_NAME,
  monthSpan,
  NO_ROOM,
  PACK_BLOCKER,
  PART_LOOK,
  SCIENCE_PARTS,
  shortDate,
  STAMP,
  WEIGHT_WORDS,
} from '../sdWords';
import * as f from '../format';

interface Props {
  base: Design;
  shelf: PartId[];
  mode: Mode;
  onMode: (m: Mode) => void;
  missionName: string;
  /** The level teaches that no packing can reach the target (Jupiter): the lesson card gives the star. */
  impossible?: boolean;
  onLesson?: () => void;
  onHome: () => void;
  onLaunch: (d: Design) => void;
}

type Hl = { dangers: string[]; parts: PartId[] } | undefined;

export function Pack({ base, shelf, mode, onMode, missionName, impossible, onLesson, onHome, onLaunch }: Props) {
  const engineer = mode === 'engineer';
  const phone = useIsPhone();
  const dest = DESTINATIONS[base.destination];
  const [packed, setPacked] = useState<Packed>(() => initialPack(base, shelf));
  const [hl, setHl] = useState<Hl>();
  const [armed, setArmed] = useState(false);
  const [noRoom, setNoRoom] = useState<PartId>();
  const [days, setDays] = useState<CalendarDay[]>();
  const [dayIdx, setDayIdx] = useState(PACK.calendar.before.value);

  // The calendar's transfers are worked out once per level, one tick after the screen paints.
  useEffect(() => {
    setDays(undefined);
    const id = setTimeout(() => setDays(calendarTransfers(base.destination, base.launchDate)), 0);
    return () => clearTimeout(id);
  }, [base.destination, base.launchDate]);

  const day = days?.[dayIdx];
  const design = useMemo(() => {
    const d = buildPackDesign(base, packed);
    return day ? onDay(d, day) : d;
  }, [base, packed, day]);
  const ev = useMemo(() => evaluateDesign(design), [design]);
  const blockers = packBlockers(packed, ev);
  const deck = dangerDeck(base.destination, packed);
  const sq = noseSquares(packed);
  const weight = cadetGauges(ev).weight;
  const quality = days ? days.map((t) => dayQuality(design, ev, t)) : [];
  const q = quality[dayIdx];
  const packedIds = new Set(packed.map((p) => p.id));
  const tray = shelf.filter((id) => !packedIds.has(id) && id !== 'computer' && id !== 'engine');
  const trayFits = tray.map((id) => ({ id, fits: fitPart(packed, id) !== undefined }));
  const full = trayFits.length > 0 && !trayFits.some((t) => t.fits);
  const ready = armed && q !== undefined && q.quality !== 'bad' && blockers.length === 0;
  const lessonCard = impossible && blockers.some((b) => b.code === 'too-heavy') ? LESSONS[base.destination] : undefined;

  const add = (id: PartId) => {
    const next = packPart(packed, id);
    if (!next) return setNoRoom(id);
    setNoRoom(undefined);
    setPacked(next);
  };
  const remove = (id: PartId) => {
    setNoRoom(undefined);
    setPacked(unpackPart(packed, id));
  };
  const lit = (id: PartId) => !!hl?.parts.includes(id);
  const hoverPart = (id: PartId) => setHl({ dangers: coversOf(id), parts: [id] });
  const hoverDanger = (id: string) => setHl({ dangers: [id], parts: partsCovering(shelf, id) });

  const badges = (id: PartId) => [
    ...coversOf(id)
      .filter((d) => deck.some((c) => c.id === d))
      .map((d) => ({ icon: dangerLook(d, HAZARDS[d]?.title ?? d).icon, color: 'var(--sd-coral)', title: `Covers ${dangerLook(d, HAZARDS[d]?.title ?? d).title.toLowerCase()}` })),
    ...(SCIENCE_PARTS.includes(id) ? [{ icon: 'star' as const, color: 'var(--sd-crt-hi)', title: 'Earns data' }] : []),
  ];

  const spaceText = full ? 'FULL · NOTHING ELSE FITS' : sq.free === 0 ? 'FULL' : `${f.num(sq.free)} SQUARES LEFT`;
  const spaceHot = full || sq.free === 0;
  const status = noRoom ? NO_ROOM : blockers[0] ? PACK_BLOCKER[blockers[0].code] : undefined;

  const nose = (
    <div className="pk-nose" aria-label="Rocket nose">
      <div className="pk-cone">{!phone && <span>ROCKET NOSE</span>}</div>
      <div className="pk-hull">
        <div className="pk-grid" role="group" aria-label={`Nose: ${spaceText}`}>
          {Array.from({ length: sq.total }, (_, i) => (
            <span key={`c${i}`} className="pk-cell" style={{ gridColumn: `${(i % PACK.grid.cols.value) + 1}`, gridRow: `${Math.floor(i / PACK.grid.cols.value) + 1}` }} />
          ))}
          {packed.map((p) => {
            const fp = footprint(p.id);
            const look = PART_LOOK[p.id];
            const locked = p.id === 'computer' || p.id === 'engine';
            return (
              <button
                key={p.id}
                type="button"
                className={`pk-part${lit(p.id) ? ' lit' : ''}${locked ? ' locked' : ''}`}
                style={{ gridColumn: `${p.c + 1} / span ${fp.w}`, gridRow: `${p.r + 1} / span ${fp.h}`, background: look.color }}
                title={locked ? `${look.name} · always packed` : `${look.name} · tap to unpack`}
                aria-label={locked ? `${look.name} (always packed)` : `Unpack ${look.name}`}
                onClick={() => !locked && remove(p.id)}
                onMouseEnter={() => hoverPart(p.id)}
                onMouseLeave={() => setHl(undefined)}
              >
                <SDIcon icon={look.icon} size={phone ? 18 : 22} color="var(--sd-paper-ink)" />
                {fp.squares > 1 && !phone && <span className="pk-part-name">{look.short}</span>}
                <span className="pk-part-badges">
                  {locked && !phone && <SDIcon icon="lock" size={13} color="var(--sd-paper-ink)" />}
                  {badges(p.id).map((b, i) => (
                    <span key={i} className="pk-badge-dot" title={b.title}>
                      <SDIcon icon={b.icon} size={phone ? 9 : 12} color={b.color} />
                    </span>
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="pk-base" />
    </div>
  );

  const scale = (
    <div className={`pk-scale ${weight.status}`} role="meter" aria-label="Weight" aria-valuemin={0} aria-valuemax={1} aria-valuenow={Math.min(1.5, weight.ratio)}>
      <span className="pk-scale-k">WEIGHT</span>
      <div className="pk-scale-tube sd-well">
        <div className="pk-scale-fill" style={{ height: `${Math.min(100, weight.ratio * 100)}%` }} />
        <div className="pk-scale-line" />
      </div>
      <span className="pk-scale-v">{WEIGHT_WORDS[weight.status]}</span>
      {engineer && (
        <span className="pk-scale-eng">
          {f.kg(ev.meters.mass.used)} / {f.kg(ev.meters.mass.limit)}
        </span>
      )}
    </div>
  );

  const shelfCards = (
    <div className="pk-tray-list">
      {trayFits.map(({ id, fits }) => {
        const look = PART_LOOK[id];
        const fp = footprint(id);
        return (
          <button
            key={id}
            type="button"
            className={`pk-tray-card${fits ? '' : ' nofit'}${lit(id) ? ' lit' : ''}`}
            aria-label={`Pack ${look.name}${fits ? '' : ' (no room)'}`}
            onClick={() => add(id)}
            onMouseEnter={() => hoverPart(id)}
            onMouseLeave={() => setHl(undefined)}
          >
            <span className="pk-mini-well">
              <span className="pk-mini" style={{ gridTemplateColumns: `repeat(${fp.w}, var(--mini))`, gridTemplateRows: `repeat(${fp.h}, var(--mini))` }}>
                {Array.from({ length: fp.squares }, (_, i) => (
                  <span key={i} style={{ background: look.color }} />
                ))}
              </span>
            </span>
            <span className="pk-tray-body">
              <span className="pk-tray-name">{look.name}</span>
              <span className={`pk-tray-state${fits ? '' : ' no'}`}>{phone ? (fits ? `${f.num(fp.squares)} SQ` : 'NO ROOM') : fits ? `FITS · ${f.num(fp.squares)} SQUARES` : 'WON’T FIT'}</span>
              {engineer && !phone && <span className="pk-tray-eng">{`${f.num(fp.w)}×${f.num(fp.h)}`}</span>}
            </span>
            <span className="pk-tray-badges">
              {badges(id).map((b, i) => (
                <span key={i} className="pk-badge-ring" title={b.title} style={{ borderColor: b.color }}>
                  <SDIcon icon={b.icon} size={phone ? 12 : 14} color={b.color} />
                </span>
              ))}
            </span>
          </button>
        );
      })}
      {tray.length === 0 && <div className="pk-empty">SHELF EMPTY. EVERYTHING IS PACKED.</div>}
    </div>
  );

  const deckList = (
    <div className="pk-deck-list" role="list" aria-label="Danger deck">
      {deck.map((c) => {
        const look = dangerLook(c.id, HAZARDS[c.id]?.title ?? c.id);
        const st = STAMP[c.stamp];
        return (
          <div
            key={c.id}
            role="listitem"
            aria-label={`${look.title}: ${st.word}`}
            className={`pk-danger${hl?.dangers.includes(c.id) ? ' lit' : ''}`}
            onMouseEnter={() => hoverDanger(c.id)}
            onMouseLeave={() => setHl(undefined)}
          >
            <span className="pk-danger-icon">
              <SDIcon icon={look.icon} size={phone ? 19 : 28} color="var(--sd-paper)" />
            </span>
            {phone ? (
              <span className="pk-danger-short">{look.short}</span>
            ) : (
              <span className="pk-danger-body">
                <span className="pk-danger-title">{look.title}</span>
                <span className="pk-danger-line">{look.line}</span>
                <span className="pk-danger-when">
                  {deckWhen(c)}
                  {engineer && c.kind === 'hazard' && HAZARDS[c.id] && <SourceInfo s={HAZARDS[c.id]!.realHistory} title={look.title.toLowerCase()} />}
                </span>
              </span>
            )}
            <span className="pk-stamp" style={{ color: st.color, borderColor: st.color }}>
              {phone ? st.short : st.word}
            </span>
          </div>
        );
      })}
    </div>
  );

  const calendar = (
    <div className="pk-cal">
      <div className="pk-cal-head">
        <span className="sd-label">{days ? `LAUNCH DAY · ${monthSpan(days[0]!.date, days[days.length - 1]!.date)}` : 'LAUNCH DAY'}</span>
        <span className={`pk-cal-msg ${q?.quality ?? ''}`}>
          {!days || !day || !q
            ? 'WORKING OUT THE LAUNCH DAYS…'
            : `${shortDate(day.date)} · ${engineer && day.c3 !== undefined ? `C3 = ${f.c3(day.c3)}` : phone ? DAY_WORDS[q.quality].short : DAY_WORDS[q.quality].msg(dest.name)}`}
        </span>
      </div>
      <div className="pk-cal-days" role="radiogroup" aria-label="Launch day">
        {(days ?? []).map((t, i) => (
          <button
            key={t.date}
            type="button"
            role="radio"
            aria-checked={i === dayIdx}
            aria-label={`${shortDate(t.date)}: ${DAY_WORDS[quality[i]!.quality].short}`}
            className={`pk-day ${quality[i]!.quality}${i === dayIdx ? ' on' : ''}`}
            title={shortDate(t.date)}
            onClick={() => setDayIdx(i)}
          />
        ))}
      </div>
      {!phone && days && (
        <div className="pk-cal-ticks">
          {days
            .filter((_, i) => i % 7 === 0)
            .map((t) => (
              <span key={t.date}>{shortDate(t.date)}</span>
            ))}
        </div>
      )}
    </div>
  );

  const launch = (
    <div className="pk-launch">
      <button type="button" className={`pk-arm${armed ? ' on' : ''}`} role="switch" aria-checked={armed} aria-label="Arm" onClick={() => setArmed((a) => !a)}>
        <span className="pk-arm-slot">
          <span className="pk-arm-knob" />
        </span>
        <span className="pk-arm-word">ARM</span>
      </button>
      <button type="button" className={`pk-go${ready ? ' ready' : ''}`} disabled={!ready} onClick={() => onLaunch(design)}>
        LAUNCH
      </button>
    </div>
  );

  const statusLine = (
    <div className="pk-status sd-well" role="status">
      <span className={`pk-space${spaceHot ? ' hot' : ''}`}>{spaceText}</span>
      {status && <span className="pk-block">· {status}</span>}
      {engineer && !phone && blockers[0]?.engine && <span className="pk-block-eng">{blockers[0].engine}</span>}
    </div>
  );

  const lesson = lessonCard && (
    <div className="pk-lesson sd-paper">
      <span className="sd-history-k">
        LESSON · {lessonCard.title.toUpperCase()}
        <SourceInfo s={lessonCard.lesson} title="the lesson" />
      </span>
      <span className="sd-history-v">{lessonCard.lesson.value}</span>
      {onLesson && (
        <button type="button" className="sd-cta red" onClick={onLesson}>
          ★ LESSON LEARNED
        </button>
      )}
    </div>
  );

  if (phone)
    return (
      <div className={`sd pk phone${engineer ? ' eng' : ''}`}>
        <div className="fly-status">
          <button type="button" className="fly-status-brand" onClick={onHome}>
            PACK
          </button>
          <ModeLever mode={mode} onMode={onMode} />
        </div>
        <div className="pk-deck-phone">
          <span className="sd-label">DANGER DECK · {dest.name.toUpperCase()}</span>
          {deckList}
        </div>
        <div className="pk-nose-row">
          {nose}
          {scale}
        </div>
        {statusLine}
        {lesson}
        {shelfCards}
        {calendar}
        {launch}
      </div>
    );

  return (
    <div className={`sd pk${engineer ? ' eng' : ''}`}>
      <header className="pk-top">
        <div className="sd-brand">
          <button type="button" className="sd-brand-name" onClick={onHome} aria-label="Signal Delay: home">
            {GAME_NAME}
          </button>
          <span className="sd-brand-sub">
            {missionName.toUpperCase()} · TO {dest.name.toUpperCase()}
          </span>
        </div>
        <MissionSteps at={0} />
        <ModeLever mode={mode} onMode={onMode} />
      </header>
      <div className="pk-main">
        <section className="pk-panel pk-tray" aria-label="Parts shelf">
          <div className="pk-panel-head">
            <span className="pk-panel-title">PARTS SHELF</span>
            <span className="sd-label dim">TAP TO PACK</span>
          </div>
          {shelfCards}
        </section>
        <section className="pk-fairing" aria-label="Nose and weight">
          <div className="pk-dots" />
          <div className="pk-nose-row">
            {nose}
            {scale}
          </div>
          {statusLine}
          {lesson}
        </section>
        <section className="pk-panel pk-deck" aria-label={`Danger deck: ${dest.name}`}>
          <div className="pk-deck-head">
            <span className="pk-panel-title">DANGER DECK · {dest.name.toUpperCase()}</span>
            <span className="pk-deck-sub">Face up. You know what’s coming.</span>
          </div>
          {deckList}
        </section>
      </div>
      <footer className="pk-bottom">
        <section className="pk-panel pk-cal-panel">{calendar}</section>
        <section className="pk-panel pk-launch-panel">{launch}</section>
      </footer>
    </div>
  );
}
