// Pure edits to the player's Design (inputs only). The engine evaluates the result.
import type { DragEvent } from 'react';
import type { Design } from '../engine/types';

export type PartPayload =
  | { kind: 'bus'; id: string }
  | { kind: 'instrument'; id: string }
  | { kind: 'engine'; id: string }
  | { kind: 'launcher'; id: string }
  | { kind: 'power'; id: 'solar' | 'rtg' };

export type SlotKind = PartPayload['kind'];

export { withBus, withEngine, withLauncher, addInstrument, removeInstrument, withPowerType, withArrayArea, withRtgCount, withPropellant, withDish, withTxPower, withGroundDish, withCaptureOrbit, withScienceOrbit, withScienceDays, withDates, withMissionClass } from '../engine/designEdits';
import { addInstrument, withBus, withEngine, withLauncher, withPowerType } from '../engine/designEdits';

export function applyPart(d: Design, p: PartPayload): Design {
  switch (p.kind) {
    case 'bus':
      return withBus(d, p.id);
    case 'instrument':
      return addInstrument(d, p.id);
    case 'engine':
      return withEngine(d, p.id);
    case 'launcher':
      return withLauncher(d, p.id);
    case 'power':
      return withPowerType(d, p.id);
  }
}

const MIME = 'application/x-mdt-part';
export function setDragPayload(e: DragEvent, p: PartPayload) {
  e.dataTransfer.setData(MIME, JSON.stringify(p));
  e.dataTransfer.effectAllowed = 'copy';
}
export function getDragPayload(e: DragEvent): PartPayload | undefined {
  try {
    const raw = e.dataTransfer.getData(MIME);
    return raw ? (JSON.parse(raw) as PartPayload) : undefined;
  } catch {
    return undefined;
  }
}
