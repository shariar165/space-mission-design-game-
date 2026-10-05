// One postcard from space, full size: the NASA picture, its title, the caption (a Sourced text with ⓘ and the "to
// verify" badge) and the image credit. Used by the flight (a new card) and the album.
import type { Postcard } from '../../../engine/postcards';
import { SourceInfo } from '../SourceInfo';
import { DESTINATIONS } from '../../../engine/data';
import { POSTCARD_WORDS } from '../../sdWords';

/** The picture's address under the site's base path (GitHub Pages serves the game from /<repo>/). */
export const postcardSrc = (c: Postcard) => `${import.meta.env.BASE_URL}${c.image}`;

export function PostcardView({ card, onClose, closeLabel = POSTCARD_WORDS.close }: { card: Postcard; onClose: () => void; closeLabel?: string }) {
  return (
    <div className="sd-overlay pc-overlay" role="dialog" aria-modal="true" aria-label={`Postcard: ${card.title}`}>
      <figure className="pc-card sd-paper">
        <span className="pc-stamp">{DESTINATIONS[card.destination].name.toUpperCase()}</span>
        <img className="pc-img" src={postcardSrc(card)} alt={card.caption.value} />
        <figcaption className="pc-body">
          <span className="pc-title">{card.title}</span>
          <span className="pc-caption">
            {card.caption.value}
            {card.caption.isGameEstimate && <span className="sd-verify">TO VERIFY</span>}
            <SourceInfo s={card.caption} title={card.title} />
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
