// DAILY MISSION · SHARE CARD (Signal Delay design, screen 05). Same mission for everyone, once a day. Each row is
// one danger; green held, amber cost you, red hurt. No spoilers: the grid shows how it went, not what you picked.
// Every number is engine output (daily.ts); the canvas only draws it.
import { useEffect, useState } from 'react';
import { dailyStreak, nextDailyIn_s, type DailyGrid, type DailyResult } from '../../engine/daily';
import { BackButton } from '../components/sd/BackButton';
import { ModeLever, type Mode } from '../components/sd/ModeLever';
import { SDIcon } from '../components/sd/SDIcon';
import { useIsPhone } from '../sdGeometry';
import { DANGER_LOOK, dangerLook, GAME_NAME, LIVE_WEATHER } from '../sdWords';
import { HAZARDS } from '../../engine/data';
import * as f from '../format';

const COLOR: Record<DailyResult, string> = { held: 'var(--sd-ok)', cost: 'var(--sd-gold)', hurt: 'var(--sd-bad)' };
const CANVAS_COLOR: Record<DailyResult, string> = { held: '#2f8a4a', cost: '#d8a21c', hurt: '#c2361d' };
const EMOJI: Record<DailyResult, string> = { held: '🟩', cost: '🟨', hurt: '🟥' };
const ICON_EMOJI: Record<string, string> = {
  'solar-storm': '☀️',
  'mars-dust-storm': '🌪️',
  debris: '☄️',
  'reaction-wheel': '⚙️',
  'memory-corruption': '💾',
  'insertion-anomaly': '🔥',
  'radiation-damage': '☢️',
};
const RESULT_WORD: Record<DailyResult, string> = { held: 'held', cost: 'cost you', hurt: 'hurt' };

const starLine = (stars: number) => '★'.repeat(stars) + '☆'.repeat(Math.max(0, 3 - stars));

/** The card's weather line: live DONKI storms or the seeded stand-in (absent on results saved before live weather). */
const weatherWord = (g: DailyGrid) => (g.weather === 'live' ? LIVE_WEATHER.live : g.weather === 'offline' ? LIVE_WEATHER.offline : undefined);

export function shareText(n: number, g: DailyGrid): string {
  const rows = g.rows.map((r) => `${ICON_EMOJI[r.type] ?? '⚠️'} ${EMOJI[r.result]}${r.realDate ? ` · ${LIVE_WEATHER.realOn.toLowerCase()} ${f.isoDate(r.realDate)}` : ''}`);
  const end = g.alive ? `🤖 alive · day ${f.num(g.endDay)}` : `💥 lost · day ${f.num(g.endDay)}`;
  const weather = g.weather === 'live' ? [LIVE_WEATHER.shareLive] : g.weather === 'offline' ? [LIVE_WEATHER.shareOffline] : [];
  return [`${GAME_NAME} · DAILY #${f.num(n)}  ${starLine(g.stars)}`, ...weather, ...(rows.length ? rows : ['🟦 a quiet flight']), end].join('\n');
}

/** Draws the share card on a canvas (layout only) and returns a PNG data URL. */
function cardImage(n: number, date: string, title: string, g: DailyGrid, streak: number): string {
  const c = document.createElement('canvas');
  const W = 880;
  const H = 260 + Math.max(1, g.rows.length) * 58 + 120;
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  if (!x) return '';
  x.fillStyle = '#efe6cf';
  x.fillRect(0, 0, W, H);
  x.fillStyle = '#d8432b';
  x.fillRect(0, 0, W, 64);
  x.fillStyle = '#efe6cf';
  x.font = '900 30px Orbitron, sans-serif';
  x.fillText(GAME_NAME, 36, 46);
  x.font = '700 22px "Share Tech Mono", monospace';
  x.textAlign = 'right';
  x.fillText(`DAILY #${f.num(n)}`, W - 36, 42);
  x.textAlign = 'left';
  x.fillStyle = '#7a715c';
  x.font = '700 20px "Share Tech Mono", monospace';
  x.fillText(`${date} · MARS${weatherWord(g) ? ` · ${weatherWord(g)}` : ''}`, 36, 116);
  x.fillStyle = '#1b1a16';
  x.font = '900 44px Orbitron, sans-serif';
  x.fillText(title, 36, 180);
  x.fillStyle = '#d8a21c';
  x.font = '48px sans-serif';
  x.textAlign = 'right';
  x.fillText(starLine(g.stars), W - 36, 180);
  x.textAlign = 'left';
  x.fillStyle = '#1b1a16';
  const top = 210;
  x.fillRect(36, top, W - 72, Math.max(1, g.rows.length) * 58 + 24);
  g.rows.forEach((r, i) => {
    const y = top + 12 + i * 58;
    x.fillStyle = '#2c2f27';
    x.fillRect(56, y, 46, 46);
    x.fillStyle = CANVAS_COLOR[r.result];
    x.fillRect(120, y, 64, 46);
    x.fillStyle = '#8a8270';
    x.font = '28px VT323, monospace';
    x.textAlign = 'right';
    x.fillText(`DAY ${f.num(r.day)}`, W - 60, y + 32);
    x.textAlign = 'left';
    x.fillStyle = '#efe6cf';
    x.font = '24px sans-serif';
    x.fillText(ICON_EMOJI[r.type] ?? '!', 64, y + 33);
  });
  x.fillStyle = '#1b1a16';
  x.font = '32px VT323, monospace';
  const footY = H - 46;
  x.fillText(g.alive ? `ROBOT ALIVE · DAY ${f.num(g.endDay)}` : `ROBOT LOST · DAY ${f.num(g.endDay)}`, 36, footY);
  x.fillStyle = '#7a715c';
  x.textAlign = 'right';
  x.fillText(`STREAK ${f.num(streak)}`, W - 36, footY);
  return c.toDataURL('image/png');
}

interface Props {
  number: number;
  date: string;
  grid: DailyGrid;
  played: string[];
  mode: Mode;
  onMode: (m: Mode) => void;
  onHome: () => void;
  /** ◂ BACK to the previous screen (Home when there is none). */
  onBack?: () => void;
  onReport?: () => void;
}

export function Daily({ number, date, grid, played, mode, onMode, onHome, onBack, onReport }: Props) {
  const phone = useIsPhone();
  const [now, setNow] = useState(() => Date.now());
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = nextDailyIn_s(now);
  const streak = dailyStreak(played, date);
  const title = grid.theme ? `${(DANGER_LOOK[grid.theme]?.title ?? HAZARDS[grid.theme]?.title ?? '').toUpperCase()} DAY` : 'QUIET CRUISE';
  const text = shareText(number, grid);
  const dateLabel = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase();

  const copy = () => {
    try {
      void navigator.clipboard?.writeText(text);
    } catch {
      /* clipboard unavailable: the text is on screen to copy by hand */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const save = () => {
    const url = cardImage(number, dateLabel, title, grid, streak);
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `signal-delay-daily-${date}.png`;
    a.click();
  };

  const card = (
    <div className="dl-card" aria-label={`Daily ${f.num(number)} result`}>
      <div className="dl-head">
        <span className="dl-brand">{GAME_NAME}</span>
        <span className="dl-no">DAILY #{f.num(number)}</span>
      </div>
      <div className="dl-body">
        <div className="dl-title-row">
          <div className="dl-title-col">
            <span className="dl-date">{dateLabel} · MARS</span>
            {weatherWord(grid) && <span className={`dl-weather ${grid.weather}`}>{weatherWord(grid)}</span>}
            <span className="dl-title">{title}</span>
          </div>
          <div className="dl-stars" aria-label={`${f.num(grid.stars)} of 3 stars`}>
            {[0, 1, 2].map((i) => (
              <SDIcon key={i} icon="star" size={phone ? 24 : 30} color={i < grid.stars ? 'var(--sd-gold)' : 'var(--sd-ink-3)'} fill={i < grid.stars} sw={1.5} />
            ))}
          </div>
        </div>
        <div className="dl-grid" role="list" aria-label="How each danger went">
          {grid.rows.length === 0 && <span className="dl-quiet">NO DANGER CARDS TODAY. A QUIET FLIGHT.</span>}
          {grid.rows.map((r, i) => (
            <div
              key={i}
              className="dl-row"
              role="listitem"
              aria-label={`${dangerLook(r.type, HAZARDS[r.type]?.title ?? r.type).title}: ${RESULT_WORD[r.result]}${r.realDate ? `, real event of ${f.isoDate(r.realDate)}` : ''}`}
            >
              <span className="dl-icon">
                <SDIcon icon={dangerLook(r.type, HAZARDS[r.type]?.title ?? r.type).icon} size={phone ? 17 : 20} color="var(--sd-paper)" />
              </span>
              <span className="dl-sq" style={{ background: COLOR[r.result] }} />
              {r.realDate && (
                <span className="dl-real" title={f.isoDate(r.realDate)}>
                  <b>{LIVE_WEATHER.realOn}</b>
                  {!phone && <span> {f.isoDate(r.realDate)}</span>}
                </span>
              )}
              <span className="dl-day">
                {phone ? 'D' : 'DAY '}
                {f.num(r.day)}
              </span>
            </div>
          ))}
        </div>
        <div className="dl-foot">
          <span>
            {grid.alive ? 'ROBOT ALIVE' : 'ROBOT LOST'} · DAY {f.num(grid.endDay)}
          </span>
          <span className="dim">STREAK {f.num(streak)}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`sd dl${phone ? ' phone' : ''}`}>
      <div className="dl-dots" />
      <div className="dl-top">
        <BackButton onBack={onBack ?? onHome} />
        <ModeLever mode={mode} onMode={onMode} />
      </div>
      <div className="dl-stage">
        {phone && <span className="dl-made">{grid.alive ? 'YOU MADE IT.' : 'THE ROBOT IS GONE.'}</span>}
        {card}
        <div className="dl-side">
          {!phone && (
            <span className="dl-made">
              {grid.alive ? 'YOU MADE IT.' : 'THE ROBOT IS GONE.'}
              <br />
              SHOW YOUR CREW.
            </span>
          )}
          {!phone && (
            <div className="dl-text sd-well">
              <span className="dl-text-k">COPIES AS TEXT</span>
              <pre className="dl-text-v">{text}</pre>
            </div>
          )}
          <div className="dl-actions">
            <button type="button" className="sd-cta" onClick={copy}>
              {copied ? 'COPIED ✓' : phone ? 'SHARE RESULT' : 'COPY RESULT'}
            </button>
            <button type="button" className="dl-btn" onClick={save}>
              SAVE IMAGE
            </button>
            {onReport && (
              <button type="button" className="dl-btn" onClick={onReport}>
                MISSION REPORT
              </button>
            )}
          </div>
          <span className="dl-next">NEXT DAILY IN {f.mmss(left)}</span>
        </div>
      </div>
    </div>
  );
}
