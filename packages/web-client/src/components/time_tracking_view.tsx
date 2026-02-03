import { getActiveDuration, getFormattedDuration } from '@eddo/core-client';
import { type FC, type ReactNode, useState } from 'react';
import { BiChevronDown, BiChevronUp } from 'react-icons/bi';

interface TimeTrackingSession {
  from: string;
  to: string | null;
}

interface TimeTrackingSummaryProps {
  expanded: boolean;
  hasActiveSession: boolean;
  onToggle: () => void;
  sessionCount: number;
  totalDuration: number;
}

interface TimeTrackingSessionsProps {
  sessions: TimeTrackingSession[];
}

interface TimeTrackingViewProps {
  active: Record<string, string | null>;
  emptyValue: ReactNode;
  labelClass: string;
}

const formatSessionTime = (value: string): string => {
  return new Date(value).toLocaleString();
};

const getSessionDuration = (session: TimeTrackingSession): number => {
  return getActiveDuration({ [session.from]: session.to });
};

const buildSessions = (entries: [string, string | null][]): TimeTrackingSession[] => {
  return entries
    .map(([from, to]) => ({ from, to }))
    .sort((a, b) => new Date(b.from).getTime() - new Date(a.from).getTime());
};

const TimeTrackingSummaryButton: FC<TimeTrackingSummaryProps> = ({
  expanded,
  hasActiveSession,
  onToggle,
  sessionCount,
  totalDuration,
}) => (
  <button
    className="flex w-full items-center justify-between rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-left transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-900/50 dark:hover:bg-neutral-800"
    onClick={onToggle}
    type="button"
  >
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Total</span>
      <span className="text-sm font-semibold text-neutral-900 dark:text-white">
        {getFormattedDuration(totalDuration) || '0m'}
      </span>
      {hasActiveSession && (
        <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
      )}
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {sessionCount} session{sessionCount !== 1 ? 's' : ''}
      </span>
    </div>
    <span className="text-neutral-400 dark:text-neutral-500">
      {expanded ? <BiChevronUp size="1.1em" /> : <BiChevronDown size="1.1em" />}
    </span>
  </button>
);

const TimeTrackingSessions: FC<TimeTrackingSessionsProps> = ({ sessions }) => (
  <div className="space-y-2">
    {sessions.map((session) => {
      const duration = getSessionDuration(session);
      return (
        <div
          className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-700 dark:border-neutral-600 dark:bg-neutral-900/50 dark:text-neutral-300"
          key={session.from}
        >
          <div className="flex items-center justify-between">
            <span className="font-medium">{session.to ? 'Completed' : 'Active'}</span>
            <span>{getFormattedDuration(duration) || '0m'}</span>
          </div>
          <div className="mt-1 text-neutral-500 dark:text-neutral-400">
            <div>Start: {formatSessionTime(session.from)}</div>
            <div>End: {session.to ? formatSessionTime(session.to) : 'In progress'}</div>
          </div>
        </div>
      );
    })}
  </div>
);

export const TimeTrackingView: FC<TimeTrackingViewProps> = ({ active, emptyValue, labelClass }) => {
  const entries = Object.entries(active);
  const totalDuration = getActiveDuration(active);
  const hasActiveSession = entries.some(([, to]) => to === null);
  const [expanded, setExpanded] = useState(false);

  if (entries.length === 0) {
    return (
      <div>
        <div className={labelClass}>Time Tracking</div>
        <div className="mt-1 text-sm text-neutral-900 dark:text-white">{emptyValue}</div>
      </div>
    );
  }

  const sessions = buildSessions(entries);

  return (
    <div>
      <div className={labelClass}>Time Tracking</div>
      <div className="mt-2 space-y-2">
        <TimeTrackingSummaryButton
          expanded={expanded}
          hasActiveSession={hasActiveSession}
          onToggle={() => setExpanded((prev) => !prev)}
          sessionCount={entries.length}
          totalDuration={totalDuration}
        />
        {expanded && <TimeTrackingSessions sessions={sessions} />}
      </div>
    </div>
  );
};
