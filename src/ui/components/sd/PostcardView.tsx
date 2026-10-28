// One postcard from space, full size: the NASA picture, its title, the caption (a Sourced text with ⓘ and the "to
// verify" badge) and the image credit. Used by the flight (a new card) and the album.
import type { Postcard } from '../../../engine/postcards';
import { SourceInfo } from '../SourceInfo';
import { said } from '../../cited';
import { DESTINATIONS } from '../../../engine/data';
import { FLY_WORDS, MAP_WORDS, POSTCARD_WORDS } from '../../sdWords';

/** The picture's address under the site's base path (GitHub Pages serves the game from /<repo>/). */
export const postcardSrc = (c: Postcard) => `${import.meta.env.BASE_URL}${c.image}`;

export function PostcardView({ card, onClose, closeLabel = POSTCARD_WORDS.close }: { card: Postcard; onClose: () => void; closeLabel?: string }) {
  const title = said(card.title);
  const caption = said(card.caption.value);
  return (
    <div className="sd-overlay pc-overlay" role="dialog" aria-modal="true" aria-label={POSTCARD_WORDS.view(title)}>
      <figure className="pc-card sd-paper">
        <span className="pc-stamp">{MAP_WORDS.planet(DESTINATIONS[card.destination].name)}</span>
        <img className="pc-img" src={postcardSrc(card)} alt={caption} />
        <figcaption className="pc-body">
          <span className="pc-title">{title}</span>
          <span className="pc-caption">
            {caption}
            {card.caption.isGameEstimate && <span className="sd-verify">{FLY_WORDS.toVerify}</span>}
            <SourceInfo s={card.caption} title={title} />
          </span>
          <span className="pc-credit">{POSTCARD_WORDS.credit(card.credit)}</span>
        </figcaption>
        <button type="button" className="sd-cta pc-close" onClick={onClose}>
          {closeLabel}
        </button>
      </figure>
    </div>
  );
}
