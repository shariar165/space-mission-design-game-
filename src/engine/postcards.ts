// Postcards from space (spec: UI rules, Postcards). Real NASA pictures of each destination, public domain, from
// the NASA Image and Video Library (src/data/postcards.json). A flight earns a card once that share of its science
// goal has reached Earth: downlinked / goal ≥ unlockAt, after the first data has arrived.
import postcardsJson from '../data/postcards.json';
import { goalGbit } from './ops/fly';
import type { OpsState } from './ops/types';
import type { DestinationId, Sourced } from './types';

export interface Postcard {
  id: string;
  destination: DestinationId;
  /** The picture's id in the NASA Image and Video Library. */
  nasaId: string;
  title: string;
  /** Path under the site root (public/). */
  image: string;
  credit: string;
  caption: Sourced<string>;
  /** Share of the science goal downlinked that opens the card. */
  unlockAt: Sourced<number>;
}

export const POSTCARDS = (postcardsJson as unknown as { postcards: Postcard[] }).postcards;

export const postcardsFor = (d: DestinationId) => POSTCARDS.filter((c) => c.destination === d);

/** The cards this flight has earned so far, in data order. */
export function postcardsEarned(s: OpsState): string[] {
  const sent = s.downlinkedPrime_bits;
  const goal = goalGbit(s) * 1e9;
  if (!(sent > 0) || !(goal > 0)) return [];
  const share = sent / goal;
  return postcardsFor(s.env.design.destination)
    .filter((c) => c.unlockAt.value <= share + 1e-12)
    .map((c) => c.id);
}

export interface AlbumCard extends Postcard {
  open: boolean;
}

/** Every card, open or still locked, and how many are open (for the album and the Home key). */
export function postcardAlbum(earned: readonly string[]): { cards: AlbumCard[]; got: number; total: number } {
  const have = new Set(earned);
  const cards = POSTCARDS.map((c) => ({ ...c, open: have.has(c.id) }));
  return { cards, got: cards.filter((c) => c.open).length, total: cards.length };
}

/** Cards in `after` that were not in `before`, in data order. */
export function newPostcards(before: readonly string[], after: readonly string[]): string[] {
  const was = new Set(before);
  const now = new Set(after);
  return POSTCARDS.filter((c) => now.has(c.id) && !was.has(c.id)).map((c) => c.id);
}
