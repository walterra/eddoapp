/**
 * VCR-style Testing Module
 *
 * Provides recording/replaying of LLM API responses for deterministic,
 * fast, and cost-effective integration tests.
 *
 * Usage:
 *   VCR_MODE=auto     - Record if cassette missing, replay if exists (default)
 *   VCR_MODE=record   - Always record fresh responses
 *   VCR_MODE=playback - Only replay, fail if cassette missing
 */
export { createCachedClaudeService } from './cached-claude-service.js';
export {
  createCassetteManager,
  type CassetteManager,
  type RecordMode,
  type TimeController,
} from './cassette-manager.js';
