import type { ReportType } from './state.js';

/** Carries channel-independent reply preparation into persisted request phases. */
export interface PreparedReply {
  answer: string;
  printable: boolean;
  reportType?: ReportType;
}
