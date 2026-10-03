import type { Grade } from '../../engine/scoring';
import type { MeterStatus } from '../../engine/types';
import { StatusIcon } from './icons';

const STATUS_LABEL: Record<MeterStatus, string> = { ok: 'OK', warning: 'WARNING', over: 'OVER LIMIT' };
const GRADE_LABEL: Record<Grade, string> = { strong: 'STRONG', fair: 'FAIR', weak: 'WEAK' };
const GRADE_CLASS: Record<Grade, MeterStatus> = { strong: 'ok', fair: 'warning', weak: 'over' };

/** Status is always icon + colour + label. */
export function StatusChip({ status, plain = false, short = false }: { status: MeterStatus; plain?: boolean; short?: boolean }) {
  return (
    <span className={`chip ${status}${plain ? ' plain' : ''}`}>
      <StatusIcon status={status} />
      {short && status === 'over' ? 'OVER' : STATUS_LABEL[status]}
    </span>
  );
}

export function GradeChip({ grade }: { grade: Grade }) {
  return (
    <span className={`chip ${GRADE_CLASS[grade]} plain`}>
      <StatusIcon status={grade} />
      {GRADE_LABEL[grade]}
    </span>
  );
}
