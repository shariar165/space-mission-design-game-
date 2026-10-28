// DOWNLINK (spec: UI rule 40; Signal Delay design screen 01). A drawer on the teletype paper: the pictures still
// on the robot, the next DSN pass, then each picture that reaches Earth prints line by line as a dithered teletype
// print and opens in full colour with its credit and the robot's comment. Numbers from downlinkView; the print is
// presentation only (the picture is already home when it starts).
import { useEffect, useRef, useState } from 'react';
import type { DownlinkView } from '../../../engine/ops/index';
import { targetById } from '../../../engine/targets';
import * as f from '../../format';
import { PRINT_DOTS, PRINT_MS } from '../../sdGeometry';
import { DOWNLINK, TARGET_WORDS, targetName } from '../../sdWords';
import { useLoop } from '../../sound';
import { SDIcon } from '../sd/SDIcon';

export const targetSrc = (id: string) => `${import.meta.env.BASE_URL}${targetById(id)?.image.file ?? ''}`;

/** Floyd–Steinberg dither of a picture to PRINT_DOTS wide: 1 = an inked dot. */
function dither(img: HTMLImageElement): { h: number; bits: Uint8Array } | undefined {
  const w = PRINT_DOTS;
  const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return undefined;
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = Math.min(1, Math.max(0, ((d[i * 4]! * 0.3 + d[i * 4 + 1]! * 0.59 + d[i * 4 + 2]! * 0.11) / 255 - 0.5) * 1.5 + 0.55)) * 255;
  const bits = new Uint8Array(w * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const old = lum[i]!;
      const ink = old < 128;
      bits[i] = ink ? 1 : 0;
      const e = old - (ink ? 0 : 255);
      if (x + 1 < w) lum[i + 1]! += (e * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) lum[i + w - 1]! += (e * 3) / 16;
        lum[i + w]! += (e * 5) / 16;
        if (x + 1 < w) lum[i + w + 1]! += e / 16;
      }
    }
  return { h, bits };
}

/** The print of one picture: rows appear over PRINT_MS, then it opens in colour. */
function Print({ id, still, onProgress }: { id: string; still: boolean; onProgress: (p: number) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [dots, setDots] = useState<{ h: number; bits: Uint8Array }>();
  const [p, setP] = useState(still ? 1 : 0);
  useEffect(() => {
    setDots(undefined);
    setP(still ? 1 : 0);
    const img = new Image();
    img.onload = () => setDots(dither(img));
    img.src = targetSrc(id);
  }, [id, still]);
  useEffect(() => {
    if (!dots || still) return;
    let raf = 0;
    const t0 = performance.now();
    const step = () => {
      const q = Math.min(1, (performance.now() - t0) / PRINT_MS);
      setP(q);
      if (q < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [dots, still]);
  useEffect(() => onProgress(p), [p]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const c = canvas.current;
    const g = c?.getContext('2d');
    if (!c || !g || !dots) return;
    c.width = PRINT_DOTS;
    c.height = dots.h;
    const rows = Math.floor(p * dots.h);
    const im = g.createImageData(PRINT_DOTS, dots.h);
    for (let i = 0; i < rows * PRINT_DOTS; i++)
      if (dots.bits[i]) {
        im.data[i * 4] = 29;
        im.data[i * 4 + 1] = 107;
        im.data[i * 4 + 2] = 52;
        im.data[i * 4 + 3] = 255;
      }
    g.putImageData(im, 0, 0);
  }, [dots, p]);
  const opened = p >= 1;
  return (
    <div className="dn-print">
      <canvas ref={canvas} className="dn-print-dots" width={PRINT_DOTS} height={dots?.h ?? PRINT_DOTS} />
      <img className={`dn-print-color${opened ? ' open' : ''}`} src={targetSrc(id)} alt={targetName(id)} />
      {!opened && <span className="dn-print-head" style={{ top: `${p * 100}%` }} />}
    </div>
  );
}

interface Props {
  view: DownlinkView;
  robotName: string;
  phone: boolean;
  still: boolean;
  onClose: () => void;
  /** Fast-forward the clock to the next pass or the next picture home (undefined: nothing to wait for). */
  onSkip?: () => void;
}

export function Downlink({ view, robotName, phone, still, onClose, onSkip }: Props) {
  const name = robotName.toUpperCase();
  const latest = view.latestHome?.targetId;
  const [printing, setPrinting] = useState<string | undefined>(latest);
  const [progress, setProgress] = useState(still ? 1 : 0);
  const seen = useRef(latest);
  useEffect(() => {
    if (!latest || latest === seen.current) return;
    seen.current = latest;
    setPrinting(latest);
  }, [latest]);
  const n = view.rows.length;
  const index = printing ? view.rows.findIndex((r) => r.targetId === printing) : -1;
  const printRow = index >= 0 ? view.rows[index] : undefined;
  const opened = printing !== undefined && progress >= 1;
  const pass = view.pass;
  const passLine = !pass ? DOWNLINK.noPass : pass.open ? DOWNLINK.passOpen(f.durationWords(pass.closesIn_s).toUpperCase()) : DOWNLINK.nextPass(f.durationWords(pass.openIn_s).toUpperCase());
  const all = n > 0 && view.waiting === 0;
  const busy = printing !== undefined && !opened;
  // The printer rattles while a picture prints line by line.
  useLoop('rattle', busy && !still);
  const key = !n
    ? { k: DOWNLINK.nothing, s: DOWNLINK.nothingSub, go: undefined }
    : busy
      ? { k: DOWNLINK.receiving, s: DOWNLINK.receivingSub, go: undefined }
      : all
        ? { k: DOWNLINK.allDone, s: DOWNLINK.allDoneSub, go: onClose }
        : onSkip && pass
          ? { k: DOWNLINK.skip, s: DOWNLINK.skipSub(f.durationWords(pass.open ? 0 : pass.openIn_s)), go: onSkip }
          : { k: DOWNLINK.receiving, s: DOWNLINK.receivingSub, go: undefined };
  const dish = pass ? `${f.num(pass.dish)} M` : '';
  const target = printing ? targetById(printing) : undefined;
  return (
    <section className={`dn-drawer sd-paper${phone ? ' phone' : ''}`} aria-label={DOWNLINK.title}>
      <div className="dn-holes" aria-hidden="true" />
      <div className="dn-body">
        <div className="dn-head">
          <div className="dn-head-l">
            <span className="dn-kicker">{phone ? DOWNLINK.kickerPhone(dish) : DOWNLINK.kicker(dish, printing ? DOWNLINK.sentBefore(f.durationWords(view.oneWay_s).toUpperCase()) : DOWNLINK.noSignal)}</span>
            <span className="dn-title">{DOWNLINK.title}</span>
          </div>
          <button type="button" className="dn-close" onClick={onClose}>
            {DOWNLINK.closeKey}
          </button>
        </div>
        <div className="dn-screen">
          <div className="dn-screen-l">
            <span className="dn-big">{all ? DOWNLINK.bigHome : DOWNLINK.big(f.num(view.waiting), view.waiting === 1)}</span>
            <span className={`dn-pass${pass?.open ? ' open' : ''}`}>{passLine}</span>
            <div className="dn-queue">
              {view.rows.map((r) => (
                <div key={r.targetId} className={`dn-row ${r.state}`}>
                  <span className="dn-row-name">{targetName(r.targetId)}</span>
                  <span className="dn-row-bar">
                    <span style={{ width: `${(r.state === 'home' || r.state === 'on-its-way' ? 1 : r.sent) * 100}%` }} />
                  </span>
                  <span className="dn-row-st">{r.state === 'coming-down' ? `${DOWNLINK.row['coming-down']} ${f.pct(r.sent, 0)}` : DOWNLINK.row[r.state]}</span>
                </div>
              ))}
            </div>
          </div>
          {!phone && (
            <button type="button" className={`dn-key${key.go ? '' : ' off'}`} disabled={!key.go} onClick={key.go}>
              <span className="dn-key-k">{key.k} ▸</span>
              <span className="dn-key-s">{key.s}</span>
            </button>
          )}
        </div>
        <div className="dn-caption">
          <span className="dn-caption-t">{printing && printRow ? DOWNLINK.imageOf(f.num(index + 1), f.num(n), targetName(printing)) : DOWNLINK.waitingDish}</span>
          <span className="dn-caption-s">{!printing ? DOWNLINK.paperLoaded : opened ? DOWNLINK.opened : DOWNLINK.printing(f.pct(progress, 0), f.bits(printRow?.bits ?? 0))}</span>
        </div>
        <div className="dn-paper">{printing ? <Print id={printing} still={still} onProgress={setProgress} /> : <SDIcon icon="dish" size={phone ? 40 : 56} />}</div>
        <div className={`dn-voice${opened ? ' on' : ''}`}>
          {printing && <span className="dn-voice-line">{DOWNLINK.voice(name, TARGET_WORDS[printing]?.comment ?? '')}</span>}
          {target && <span className="dn-credit">{DOWNLINK.credit(target.image.credit, target.image.mission, target.image.nasaId)}</span>}
        </div>
        {phone && (
          <button type="button" className={`dn-key${key.go ? '' : ' off'}`} disabled={!key.go} onClick={key.go}>
            <span className="dn-key-k">{key.k} ▸</span>
          </button>
        )}
      </div>
    </section>
  );
}
