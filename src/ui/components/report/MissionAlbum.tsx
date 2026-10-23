// MISSION ALBUM (spec: UI rule 43; Signal Delay design screen 03). The report opens with what came home: one frame
// per science target, in colour if its picture came home, SIGNAL LOST if it was cut off, NOT RETURNED with why if
// not; a science bar with one block per target sized by its weight. Numbers from missionAlbum (engine).
import type { CSSProperties } from 'react';
import type { MissionAlbum as Album } from '../../../engine/ops/index';
import { targetById } from '../../../engine/targets';
import * as f from '../../format';
import { ALBUM, targetName } from '../../sdWords';
import { targetSrc } from '../fly/Downlink';

interface Props {
  album: Album;
  name: string;
  phone: boolean;
  /** FEED THE PAPER: on to the final transmission. */
  onFeed: () => void;
}

export function MissionAlbum({ album, name, phone, onFeed }: Props) {
  const day = f.dayPad(album.day);
  const pct = f.pct(album.science, 0);
  const n = f.num(album.returned);
  const total = f.num(album.total);
  const lost = album.ending === 'lost';
  const big = lost ? ALBUM.lostOn(name, day) : ALBUM.returned(n, total);
  const big2 = lost ? (album.returned ? ALBUM.madeIt(n, album.returned === 1) : ALBUM.noneMadeIt) : album.ending === 'extended' ? ALBUM.soFar(pct) : ALBUM.ofScience(pct);
  const sub = lost ? `${ALBUM.returned(n, total)} · ${ALBUM.ofScience(pct)}` : album.ending === 'extended' ? ALBUM.subExtended(name, day) : ALBUM.subComplete(name, day);
  const foot = album.returned === album.total ? ALBUM.foot.all : album.returned === 0 && !lost ? ALBUM.foot.none : ALBUM.foot[album.ending];
  return (
    <section className={`al ${album.ending}${phone ? ' phone' : ''}`} aria-label={ALBUM.label}>
      <div className="al-head">
        <div className="al-meta">
          <span>{ALBUM.kicker(name)}</span>
          {!phone && <span>{ALBUM.meta[album.ending](day)}</span>}
        </div>
        <h2 className="al-big">
          <span className="al-big-1">{big}</span>
          <span className="al-big-2">{big2}</span>
        </h2>
        <span className="al-sub">{sub}</span>
      </div>
      <div className="al-bar-wrap">
        <div className="al-bar" role="img" aria-label={ALBUM.barPct(pct)}>
          {album.frames.map((fr) => (
            <span key={fr.targetId} className={`al-block ${fr.status}`} style={{ flexGrow: fr.weight }} title={targetName(fr.targetId)} />
          ))}
        </div>
        {!phone && (
          <div className="al-bar-k">
            <span>{ALBUM.bar}</span>
            <span>{ALBUM.barPct(pct)}</span>
          </div>
        )}
      </div>
      <div className="al-grid">
        {album.frames.map((fr) => {
          const t = targetById(fr.targetId)!;
          const w = f.pct(fr.weight, 0);
          return (
            <div key={fr.targetId} className={`al-frame ${fr.status}`} role="group" aria-label={targetName(fr.targetId)}>
              <div className="al-mount">
                {fr.status === 'home' && <img className="al-img" src={targetSrc(fr.targetId)} alt={targetName(fr.targetId)} />}
                {fr.status === 'partial' && (
                  <div className="al-partial">
                    <img className="al-img" src={targetSrc(fr.targetId)} alt="" style={{ '--sent': fr.sent ?? 0 } as CSSProperties} />
                    <span className="al-lost">{ALBUM.signalLost}</span>
                  </div>
                )}
                {fr.status === 'missing' && (
                  <div className="al-miss">
                    <span className="al-miss-k">{ALBUM.notReturned}</span>
                    <span className="al-miss-v">{(ALBUM.why[fr.why ?? 'never-ordered'] ?? ALBUM.why['never-ordered']!)(f.dayPad(fr.day ?? 0))}</span>
                  </div>
                )}
              </div>
              <div className="al-cap">
                <span className="al-name">{targetName(fr.targetId)}</span>
                <span className="al-sci">{fr.status === 'home' ? ALBUM.plus(w) : fr.status === 'partial' ? ALBUM.partialSci : ALBUM.missed(w)}</span>
              </div>
              {!phone && (
                <span className="al-credit">
                  {fr.status === 'home' ? ALBUM.credit(t.image.credit, t.image.mission) : fr.status === 'partial' ? ALBUM.partialCap(f.pct(fr.sent ?? 0, 0)) : ''}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="al-foot">
        <span className="al-foot-t">{foot}</span>
        {!phone && (
          <button type="button" className="al-feed" onClick={onFeed}>
            {ALBUM.feed}
          </button>
        )}
      </div>
    </section>
  );
}
