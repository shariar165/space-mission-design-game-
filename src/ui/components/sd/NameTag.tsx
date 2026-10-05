// Pack: name your robot. The name goes over the robot on the map, into its radio messages and onto the report.
// Words in sdWords (ROBOT_WORDS, ROBOT_NAMES); saved in the browser (saves.ts sd.robot).
import { cleanRobotName, nextRobotName, ROBOT_NAME_MAX, ROBOT_WORDS, robotNameOr } from '../../sdWords';

export function NameTag({ name, onName }: { name: string; onName: (name: string) => void }) {
  return (
    <div className="sd-nametag">
      <label className="sd-nametag-k" htmlFor="sd-robot-name">
        {ROBOT_WORDS.nameLabel}
      </label>
      <span className="sd-nametag-row">
        <input
          id="sd-robot-name"
          className="sd-nametag-input sd-well"
          value={name}
          placeholder={robotNameOr('')}
          maxLength={ROBOT_NAME_MAX}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onName(cleanRobotName(e.target.value))}
        />
        <button type="button" className="sd-ghost-btn sd-nametag-dice" aria-label={ROBOT_WORDS.suggest} title={ROBOT_WORDS.suggest} onClick={() => onName(nextRobotName(robotNameOr(name)))}>
          🎲
        </button>
      </span>
    </div>
  );
}
