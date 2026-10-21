// What the robot's lines need besides the message (sdWords robotSays): the destination, its name, and how to say a
// hazard and a chosen option the way the danger cards do.
import { HAZARDS } from '../engine/data';
import { optionShort, robotNameOr, type VoiceContext } from './sdWords';

export const voiceContext = (dest: string, robotName?: string): VoiceContext => ({
  dest,
  name: robotNameOr(robotName),
  option: (type, id) => optionShort(type, id, HAZARDS[type]?.options.find((o) => o.id === id)?.label ?? id),
  hazard: (type) => HAZARDS[type]?.title ?? type,
});
