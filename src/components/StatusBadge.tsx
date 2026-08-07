import type { PatrolStatus } from '../hooks/usePatrolLogs';

const config: Record<PatrolStatus, { label: string; classes: string; dot: string }> = {
  SUCCESS: {
    label: 'Success',
    classes: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  OUT_OF_RANGE: {
    label: 'Out of Range',
    classes: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
    dot: 'bg-amber-400',
  },
  UNKNOWN_QR: {
    label: 'Unknown QR',
    classes: 'bg-red-500/15 text-red-400 border border-red-500/30',
    dot: 'bg-red-400',
  },
  FLAGGED: {
    label: 'Flagged',
    classes: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
    dot: 'bg-purple-400',
  },
};

interface StatusBadgeProps {
  status: PatrolStatus;
  showDot?: boolean;
}

export function StatusBadge({ status, showDot = true }: StatusBadgeProps) {
  const { label, classes, dot } = config[status];
  return (
    <span className={`badge ${classes}`}>
      {showDot && <span className={`inline-block w-1.5 h-1.5 rounded-full ${dot}`} />}
      {label}
    </span>
  );
}
