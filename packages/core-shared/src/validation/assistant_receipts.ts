import { validateTextLength } from './compatibility';
import { createProjectedParser } from './projected_parser';
import { arr, bool, obj, oneOf, str, type SchemaIssue, type Static } from './schema_parser';

export const receiptDefinition = obj({
  requestId: str({ minLength: 1, maxLength: 256 }),
  conversationId: str({ minLength: 1, maxLength: 256 }),
  status: oneOf([
    'queued',
    'working',
    'delivering',
    'projecting',
    'completed',
    'failed',
    'aborted',
  ]),
});
type Receipt = Static<typeof receiptDefinition>;

/** Preserves UTF-16 identifier bounds after structural receipt validation. */
export function validateReceipt(value: Receipt, path = ''): SchemaIssue[] {
  return [
    ...validateTextLength(value.requestId, 256, `${path}/requestId`),
    ...validateTextLength(value.conversationId, 256, `${path}/conversationId`),
  ];
}

export const receiptSchema = createProjectedParser(receiptDefinition, {
  validate: validateReceipt,
});
export const sharedRequestsSchema = createProjectedParser(
  obj({ requests: arr(receiptDefinition, { maxItems: 100 }), hasMore: bool() }),
  {
    validate: (value) =>
      value.requests.flatMap((receipt, index) => validateReceipt(receipt, `/requests/${index}`)),
  },
);
