// The data's cited texts in the player's language (spec UI rule 48). The data stays English and Sourced; a screen
// shows `said(s.value)` and hands ⓘ the Sourced record itself, so the English original, its source and its link stay
// one tap away. The Bangla lives in cited.bn.ts, keyed by the exact English.
import { CITED_BN } from './cited.bn';
import { lang } from './lang';

/** A cited text (or a data title) as the player reads it: its Bangla when Bangla is on and it has one. */
export const said = (en: string): string => (lang() === 'bn' ? (CITED_BN[en] ?? en) : en);

/** Whether this English text has a Bangla version (ⓘ then labels the English as the original). */
export const hasBangla = (en: unknown): boolean => typeof en === 'string' && CITED_BN[en] !== undefined;
