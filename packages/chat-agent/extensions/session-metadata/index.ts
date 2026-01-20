/**
 * Session Metadata Extension
 *
 * Injects pi session metadata into the agent's context via before_agent_start.
 * The agent can then include this metadata when calling skills.
 *
 * Metadata injected:
 * - PI_SESSION_ID: Session UUID
 * - PI_MODEL: Current model identifier
 * - PI_CWD: Working directory
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import * as path from 'node:path';

export default function sessionMetadataExtension(pi: ExtensionAPI): void {
  pi.on('before_agent_start', async (_event, ctx) => {
    // Extract session ID from session file path
    const sessionFile = ctx.sessionManager.getSessionFile();
    const sessionId = sessionFile ? path.basename(sessionFile, '.json') : 'ephemeral';

    const model = ctx.model?.id ?? 'unknown';
    const cwd = ctx.cwd;

    // Inject metadata into system prompt
    const metadataBlock = `
<pi_session_metadata>
PI_SESSION_ID="${sessionId}"
PI_MODEL="${model}"
PI_CWD="${cwd}"
</pi_session_metadata>
`;

    return {
      systemPrompt: _event.systemPrompt + metadataBlock,
    };
  });
}
