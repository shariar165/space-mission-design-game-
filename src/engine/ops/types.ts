// Mission operations types (spec: "Mission operations"). The state is plain data: a mission is a function of
// (design, seed, actions), so a save or a replay needs only those three.
import type { PhaseWindow } from '../crisis';
import type { HazardOption, OpsPhase } from '../data';
import type { FullEvaluation } from '../index';
import type { Design } from '../types';

export type { OpsPhase } from '../data';

/** Event values: numbers in SI or days, ISO dates, ids. Never English sentences (spec: messages are data). */
export type EventValues = Record<string, number | string | boolean>;

export type OpsEventCode =
  | 'launch'
  | 'launch-failed'
  | 'phase-start'
  | 'burn'
  | 'out-of-propellant'
  | 'conjunction-start'
  | 'conjunction-end'
  | 'eclipse-season-start'
  | 'eclipse-season-end'
  | 'dose-milestone'
  | 'hazard-warning'
  | 'hazard-onset'
  | 'hazard-known'
  | 'hazard-end'
  | 'wheel-spare-took-over'
  | 'decision-open'
  | 'command-sent'
  | 'command-refused'
  | 'command-executed'
  | 'command-too-late'
  | 'response-unaffordable'
  | 'deadline-missed'
  | 'response-outcome'
  | 'instrument-lost'
  | 'stored-data-lost'
  | 'safe-mode'
  | 'load-shed'
  | 'brownout'
  | 'dsn-booked'
  | 'dsn-refused'
  | 'craft-lost'
  | 'prime-complete'
  | 'extension-decided'
  | 'mission-complete';

export interface OpsEvent {
  /** Mission time, days from launch (fractional). */
  t: number;
  code: OpsEventCode;
  values: EventValues;
}

/** One mission day of the fixed environment (no player choice changes these). */
export interface EnvDay {
  day: number;
  jd: number;
  date: string;
  phase: OpsPhase;
  sunDistance_m: number;
  earthDistance_m: number;
  oneWay_s: number;
  /** Sun–Earth–probe angle (deg); undefined for the Moon (no lunar ephemeris). */
  sepAngle_deg?: number;
  conjunction: boolean;
  eclipseFraction: number;
  longestEclipse_s: number;
  /** Solar array output at the craft's Sun distance and age, or RTG output (W), before eclipses. */
  generation_W: number;
  /** Generation after eclipses and the battery limit: min(P(1 − f), E_batt / t_ecl,max) (W). */
  available_W: number;
  heaterNeed_W: number;
  /** Downlink rate to a 34 m and a 70 m station that day (bit/s). */
  rate34_bps: number;
  rate70_bps: number;
  doseRate_radPerDay: number;
  solarActivity: number;
  /** Mars only: areocentric solar longitude (deg). */
  ls_deg?: number;
}

export interface PlannedBurn {
  day: number;
  dv_ms: number;
  kind: 'trajectory-correction' | 'route-manoeuvre' | 'arrival' | 'maintenance';
}

export interface ConjunctionWindow {
  startDay: number;
  endDay: number;
  minDay: number;
  minAngle_deg: number;
  startDate: string;
  endDate: string;
}

export interface EclipseSeason {
  startDay: number;
  endDay: number;
  longestEclipse_s: number;
  maxFraction: number;
  startDate: string;
  endDate: string;
}

export interface OpsEnvironment {
  design: Design;
  ev: FullEvaluation;
  jdLaunch: number;
  timeline: PhaseWindow[];
  arrivalDay: number;
  /** Last day of the prime mission (end of science, or end of the trip home for sample return). */
  primeEndDay: number;
  /** Last day the environment covers (prime + the longest extension, for orbiters). */
  horizonDay: number;
  /** Orbiters can ask for an extension; sample-return missions end at home. */
  extensible: boolean;
  days: EnvDay[];
  burns: PlannedBurn[];
  conjunctions: ConjunctionWindow[];
  eclipseSeasons: EclipseSeason[];
  loads: {
    /** Bus + engine (W): never shed. */
    bus_W: number;
    /** Transmitter DC draw (W). */
    radio_W: number;
    heaterBase_W: number;
    instruments: { id: string; power_W: number; data_bitsPerDay: number }[];
  };
  battery_Wh: number;
  dryMass_kg: number;
  isp_s: number;
  /** Δv kept for an extension at launch (m/s): the lifetime reserve. */
  lifetimeReserve_ms: number;
  /** Δv per day of orbit maintenance (m/s). */
  maintenancePerDay_ms: number;
}

/** What the craft does with its power: instrument duty cycles (0–1), heater fraction of need, radio on/off. */
export interface PowerPlan {
  instruments: Record<string, number>;
  heaters: number;
  radio: boolean;
}

export interface DsnBooking {
  dish: 34 | 70;
  hours: number;
}

/** Commands to the craft. Standing orders are on-board rules, so changing them in flight is a command too. */
export type Command =
  | { kind: 'power-plan'; plan: PowerPlan }
  | { kind: 'respond'; hazardId: string; optionId: string }
  | { kind: 'standing-orders'; orders: Record<string, string> };

export interface CommandRecord {
  id: number;
  sentAt: number;
  arrivesAt: number;
  command: Command;
  status: 'in-flight' | 'executed' | 'too-late';
}

export interface CommandReceipt {
  accepted: boolean;
  sentAt: number;
  arrivesAt?: number;
  reason?: 'conjunction' | 'not-flying' | 'unknown-decision' | 'unknown-option' | 'already-commanded' | 'lead-time' | 'out-of-range';
  /** For a refusal in a conjunction moratorium: the first day a command can be sent. */
  retryAfterDay?: number;
}

/** A player action, timestamped: the replay log. */
export type OpsAction =
  | { t: number; kind: 'command'; command: Command }
  | { t: number; kind: 'decide'; decisionId: string; optionId: string }
  | { t: number; kind: 'dsn'; fromDay: number; toDay: number; booking: DsnBooking };

export type ResponseSource = 'player' | 'standing-order' | 'fault-protection';

export interface HazardRecord {
  id: string;
  type: string;
  onset: number;
  knownAt: number;
  deadline: number;
  endsAt: number;
  /** Uniform number drawn at the start for the outcome (same random numbers whatever the player does). */
  uOutcome: number;
  status: 'pending' | 'open' | 'resolved';
  /** Lifecycle steps already processed. */
  onsetDone: boolean;
  knownDone: boolean;
  endDone: boolean;
  /** When the chosen response's outcome lands: max(onset, execution). */
  resolveAt?: number;
  outcomeDone: boolean;
  /** Options the margins could pay for when Earth learned of it. */
  offered?: string[];
  choice?: {
    optionId: string;
    by: ResponseSource;
    executedAt: number;
    choseSafest: boolean;
    badOutcome?: boolean;
  };
}

export interface Decision {
  id: string;
  kind: 'hazard' | 'extension';
  hazardId?: string;
  openedAt: number;
  /** Earliest a response can be sent (after the team has reacted). */
  earliestSend: number;
  /** Time by which a response must reach the craft. */
  deadline?: number;
  hazardOptions?: HazardOption[];
  extensionOptions?: ExtensionOption[];
  safestOptionId?: string;
  /** A response is on its way (or the decision is settled). */
  commanded: boolean;
}

export interface ExtensionOption {
  id: string;
  years: number;
  days: number;
  deltaVNeeded_ms: number;
  deltaVLeft_ms: number;
  powerMarginAtEnd: number;
  doseAtEnd_rad?: number;
  doseTolerance_rad?: number;
  expectedData_Gbit: number;
  cost_M: number;
  approved: boolean;
  /** Reasons it cannot be offered; empty when offered. */
  blockedBy: ('deltaV' | 'power' | 'radiation' | 'attitude' | 'science-review')[];
}

export interface OpsDay {
  day: number;
  date: string;
  phase: OpsPhase;
  conjunction: boolean;
  eclipseFraction: number;
  /** Day averages (W). */
  available_W: number;
  demand_W: { bus: number; heaters: number; instruments: number; radio: number };
  served_W: { bus: number; heaters: number; instruments: number; radio: number };
  cold: boolean;
  brownout: boolean;
  produced_bits: number;
  downlinked_bits: number;
  lost_bits: number;
  recorder_bits: number;
  dv_ms: number;
  propellant_kg: number;
  propellantLeft_kg: number;
  cost_M: number;
  dose_rad: number;
  /** Fraction of the day the instruments were collecting science. */
  scienceActive: number;
}

export type OpsStatus = 'not-launched' | 'flying' | 'awaiting-extension' | 'lost' | 'complete';

/** Pre-drawn random numbers (spec: determinism). Shared, never mutated. */
export interface Candidate {
  t: number;
  uAccept: number;
  uOutcome: number;
}
export interface RandomDraws {
  launch: number;
  insertion: { uAccept: number; uOutcome: number };
  candidates: Record<string, { bound_perDay: number; list: Candidate[] }>;
}

export interface OpsState {
  env: OpsEnvironment;
  draws: RandomDraws;
  seed?: number;
  t: number;
  /** Last whole day whose start-of-day actions ran (−1 before launch). */
  startedDay: number;
  status: OpsStatus;
  failedPhase?: OpsPhase;
  failureT?: number;
  mass_kg: number;
  burnsDone: number;
  dvPlannedSpent_ms: number;
  /** Δv spent on hazard responses in the prime mission, and in the extension (m/s). */
  dvResponses_ms: number;
  dvExtensionResponses_ms: number;
  /** Operations cost of the prime science days, DSN extras and response costs ($M). */
  opsCost_M: number;
  dsnExtra_M: number;
  responseBudget_M: number;
  extensionCost_M: number;
  recorder_bits: number;
  produced_bits: number;
  downlinkedPrime_bits: number;
  downlinkedExtension_bits: number;
  lost_bits: number;
  radioLimited: boolean;
  scienceDaysAchieved: number;
  pausedUntil: number;
  instrumentsLost: string[];
  wheelsWorking: number;
  attitude: 'wheels' | 'thrusters' | 'hybrid' | 'degraded';
  oneTimeUsed: string[];
  dose_rad: number;
  coldDays: number;
  brownoutStreak: number;
  plan: PowerPlan;
  dsn: Record<number, DsnBooking>;
  standingOrders: Record<string, string>;
  cursors: Record<string, number>;
  hazards: HazardRecord[];
  decisions: Decision[];
  commands: CommandRecord[];
  actions: OpsAction[];
  ledger: OpsDay[];
  today: OpsDay;
  events: OpsEvent[];
  extension?: { optionId: string; years: number; startDay: number; endDay: number };
  extensionDecided: boolean;
  /** Ids of decisions opened in the last advance (the UI's "new" list; advance stops when non-empty). */
  newDecisions: string[];
}
