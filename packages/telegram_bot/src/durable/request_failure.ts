import type { TaskOutcome } from '@earendil-works/pi-durable';

export interface DeliveredRequestFailure extends Error {
  answerDelivered: true;
}

/** Records generation failure separately from successful delivery of its user-facing notice. */
export function requestOutcome(answer: string, failure?: string): TaskOutcome<string> {
  return failure
    ? {
        status: 'failed',
        result: answer,
        error: { message: failure, detail: { answerDelivered: true } },
      }
    : { status: 'completed', result: answer };
}

/** Marks failures whose durable delivery already notified the user. */
export function deliveredRequestFailure(message: string): DeliveredRequestFailure {
  return Object.assign(new Error(message), {
    name: 'DeliveredRequestFailure',
    answerDelivered: true as const,
  });
}

/** Prevents an additional generic reply after a durable failure notice was delivered. */
export function isDeliveredRequestFailure(error: unknown): error is DeliveredRequestFailure {
  return (
    error instanceof Error &&
    error.name === 'DeliveredRequestFailure' &&
    'answerDelivered' in error &&
    error.answerDelivered === true
  );
}
