import type { AssistantRequestState } from '@eddo/core-shared';
import { isTerminalAssistantRequest } from './assistant_state';
import type { AssistantErrorCode, AssistantSession, AssistantSnapshot } from './assistant_types';

const errors: Record<AssistantErrorCode, string> = {
  unauthorized: 'Sign in again to use the assistant.',
  forbidden: 'Assistant access is unavailable. Check your account and MCP integration settings.',
  invalid_request: 'The message could not be accepted. Check its length before continuing.',
  request_conflict: 'Request identity conflict. Review the conversation before continuing.',
  rate_limited: 'Request limit reached. Reconnection will respect the server delay.',
  unavailable: 'Assistant service unavailable. Accepted work may still be running.',
  network: 'Connection interrupted. Pending work is unchanged.',
  protocol: 'Unexpected server response. Refresh history before continuing.',
  storage: 'Pending request recovery is unavailable. Enable browser storage before sending.',
  unsupported: 'A secure browser context is required. Use HTTPS or localhost to send messages.',
};
const states: Record<AssistantRequestState, string> = {
  queued: 'Queued',
  working: 'Working',
  delivering: 'Preparing reply',
  projecting: 'Saving conversation',
  completed: 'Completed',
  failed: 'Request failed',
  aborted: 'Request stopped',
};
const button =
  'rounded px-2 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 dark:text-primary-300 dark:hover:bg-neutral-700';
interface AssistantStatusProps {
  state: AssistantSnapshot;
  session: AssistantSession;
  onSignIn: () => void;
}
interface ErrorNoticeProps {
  error: AssistantErrorCode;
  session: AssistantSession;
  onSignIn: () => void;
}
interface PendingNoticeProps {
  state: AssistantSnapshot;
  session: AssistantSession;
}

function ErrorNotice({ error, session, onSignIn }: ErrorNoticeProps) {
  return (
    <div className="flex items-start justify-between gap-2" role="alert">
      <span>{errors[error]}</span>
      <button
        className={button}
        onClick={() => (error === 'unauthorized' ? onSignIn() : void session.refresh())}
        type="button"
      >
        {error === 'unauthorized' ? 'Sign in' : 'Refresh'}
      </button>
    </div>
  );
}
function description(state: AssistantSnapshot): string {
  const status = state.pending?.receipt?.status;
  if (status === 'failed' || status === 'aborted')
    return 'Review task state before repeating mutations.';
  if (isTerminalAssistantRequest(status))
    return 'Refresh or load earlier messages to locate this reply.';
  return 'Accepted work continues when this sidebar closes.';
}
function label(state: AssistantSnapshot): string {
  if (state.submitting) return 'Sending…';
  const status = state.pending?.receipt?.status;
  return status ? states[status] : 'Awaiting confirmation';
}
function PendingActions({ state, session }: PendingNoticeProps) {
  if (isTerminalAssistantRequest(state.pending?.receipt?.status))
    return (
      <button className={button} onClick={session.dismiss} type="button">
        Dismiss notice
      </button>
    );
  return (
    <button
      className={button}
      disabled={state.submitting}
      onClick={() => void session.retry()}
      type="button"
    >
      {state.pending?.receipt ? 'Check status' : 'Check / retry same request'}
    </button>
  );
}
function PendingNotice({ state, session }: PendingNoticeProps) {
  const earlier =
    state.pending?.conversationId &&
    state.conversation &&
    state.pending.conversationId !== state.conversation._id;
  return (
    <div className="space-y-1" role="status">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{label(state)}</span>
        <PendingActions session={session} state={state} />
      </div>
      <p>{description(state)}</p>
      {earlier && <p>This request belongs to an earlier conversation.</p>}
    </div>
  );
}

interface SharedNoticeProps {
  state: AssistantSnapshot;
}
function SharedNotice({ state }: SharedNoticeProps) {
  const requests = (state.sharedRequests ?? []).filter(
    (request) => request.requestId !== state.pending?.receipt?.requestId,
  );
  if (!requests.length && !state.sharedHasMore) return null;
  const phases = [...new Set(requests.map((request) => states[request.status]))].join(' · ');
  const earlier = requests.filter(
    (request) => request.conversationId !== state.conversation?._id,
  ).length;
  return (
    <div role="status">
      {requests.length > 0 && (
        <p>
          {requests.length} shared request{requests.length === 1 ? '' : 's'} in progress.
        </p>
      )}
      {requests.length > 0 && <p>{phases}</p>}
      {earlier > 0 && <p>{earlier} in an earlier conversation.</p>}
      {state.sharedHasMore && <p>Checking additional shared work…</p>}
    </div>
  );
}

/** Distinguishes unknown admission from failure without offering mutation replay after terminal outcomes. */
export function AssistantStatus({ state, session, onSignIn }: AssistantStatusProps) {
  if (!state.error && !state.pending && !state.sharedRequests?.length && !state.sharedHasMore)
    return null;
  return (
    <div className="space-y-2 px-3 py-2 text-xs text-neutral-600 dark:text-neutral-300">
      {state.error && <ErrorNotice error={state.error} onSignIn={onSignIn} session={session} />}
      {state.pending && <PendingNotice session={session} state={state} />}
      <SharedNotice state={state} />
    </div>
  );
}
