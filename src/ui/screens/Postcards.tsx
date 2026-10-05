// POSTCARDS FROM SPACE: every real NASA picture the player's robots have sent home, and the locked ones with how
// to earn them. The album and its counts come from the engine (postcards.ts postcardAlbum).
import { useState } from 'react';
import { DESTINATIONS } from '../../engine/data';
import { postcardAlbum, type AlbumCard } from '../../engine/postcards';
import { BackButton } from '../components/sd/BackButton';
import { PostcardView, postcardSrc } from '../components/sd/PostcardView';
import { useIsPhone } from '../sdGeometry';
import { GAME_NAME, POSTCARD_WORDS } from '../sdWords';
import * as f from '../format';

interface Props {
  earned: string[];
  onHome: () => void;
  onBack?: () => void;
}

export function Postcards({ earned, onHome, onBack }: Props) {
  const phone = useIsPhone();
  const album = postcardAlbum(earned);
  const [open, setOpen] = useState<AlbumCard>();
  return (
    <div className={`sd pc${phone ? ' phone' : ''}`}>
      <header className="pc-head">
        {onBack && <BackButton onBack={onBack} />}
        <div className="sd-brand">
          <button type="button" className="sd-brand-name" onClick={onHome} aria-label="Signal Delay: home">
            {GAME_NAME}
          </button>
          <span className="sd-brand-sub">{POSTCARD_WORDS.title}</span>
        </div>
        <span className="pc-count">
          {f.num(album.got)} / {f.num(album.total)}
        </span>
      </header>
      <p className="pc-sub">{POSTCARD_WORDS.sub}</p>
      <ul className="pc-grid" aria-label={POSTCARD_WORDS.title}>
        {album.cards.map((c) => {
          const dest = DESTINATIONS[c.destination].name;
          return (
            <li key={c.id}>
              {c.open ? (
                <button type="button" className="pc-tile open" onClick={() => setOpen(c)} aria-label={`${c.title} (${dest})`}>
                  <img src={postcardSrc(c)} alt="" loading="lazy" />
                  <span className="pc-tile-dest">{dest.toUpperCase()}</span>
                  <span className="pc-tile-title">{c.title}</span>
                </button>
              ) : (
                <div className="pc-tile locked" aria-label={`${POSTCARD_WORDS.locked}: ${POSTCARD_WORDS.hint(dest, c.unlockAt.value)}`}>
                  <span className="pc-tile-lock">📮</span>
                  <span className="pc-tile-dest">{dest.toUpperCase()}</span>
                  <span className="pc-tile-hint">{POSTCARD_WORDS.hint(dest, c.unlockAt.value)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {open && <PostcardView card={open} onClose={() => setOpen(undefined)} />}
    </div>
  );
}
