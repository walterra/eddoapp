/**
 * Helper functions for start/status commands
 */

/**
 * Escapes special characters for Markdown
 * @param text - Text to escape
 * @returns Escaped text
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/[_*[\]()~`>#+=|{}.!-]/g, '\\$&');
}

/**
 * Formats a date for display in Markdown
 * @param date - Date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date | undefined): string {
  if (!date) return 'Unknown';
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Formats uptime in hours and minutes
 * @param uptimeMs - Uptime in milliseconds
 * @returns Formatted uptime string
 */
export function formatUptime(uptimeMs: number): string {
  const hours = Math.floor(uptimeMs / 3600000);
  const minutes = Math.floor((uptimeMs % 3600000) / 60000);
  return `${hours}h ${minutes}m`;
}

interface ConnectionMetrics {
  totalUptime: number;
  connectAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  lastConnectionTime?: Date;
  lastDisconnectionTime?: Date;
}

/**
 * Builds MCP connection metrics section
 * @param state - Connection state
 * @param metrics - Connection metrics
 * @returns Formatted metrics string
 */
export function buildMcpMetricsSection(state: string, metrics: ConnectionMetrics | null): string {
  if (!metrics) return '';

  const lines = [
    '',
    '*MCP Connection Metrics:*',
    `• Connection State: ${escapeMarkdown(state)}`,
    `• Connect Attempts: ${metrics.connectAttempts}`,
    `• Successful Connections: ${metrics.successfulConnections}`,
    `• Failed Connections: ${metrics.failedConnections}`,
    `• Total Uptime: ${formatUptime(metrics.totalUptime)}`,
  ];

  if (metrics.lastConnectionTime) {
    lines.push(`• Last Connected: ${escapeMarkdown(formatDate(metrics.lastConnectionTime))}`);
  }

  if (metrics.lastDisconnectionTime) {
    lines.push(`• Last Disconnected: ${escapeMarkdown(formatDate(metrics.lastDisconnectionTime))}`);
  }

  return lines.join('\n');
}

interface SessionInfo {
  userId?: string;
  lastActivity?: Date;
  conversationId?: string;
}

/**
 * Builds session info section
 * @param session - Session data
 * @returns Formatted session section
 */
export function buildSessionSection(session: SessionInfo | undefined): string {
  const userId = escapeMarkdown(session?.userId || 'Unknown');
  const lastActivity = escapeMarkdown(formatDate(session?.lastActivity));
  const conversationActive = session?.conversationId ? 'Yes' : 'No';

  return `*Session Info:*
• User ID: ${userId}
• Last Activity: ${lastActivity}
• Conversation Active: ${conversationActive}`;
}

interface AgentStatus {
  version: string;
  workflowType: string;
  uptime: number;
  simpleFeatures?: { mcpToolsAvailable?: number };
}

/**
 * Builds agent info section
 * @param agentStatus - Agent status info
 * @returns Formatted agent section
 */
export function buildAgentSection(agentStatus: AgentStatus): string {
  const uptimeMin = Math.floor(agentStatus.uptime / 60);
  const uptimeSec = Math.floor(agentStatus.uptime % 60);

  return `*Agent Info:*
• Version: ${escapeMarkdown(agentStatus.version)}
• Workflow: ${escapeMarkdown(agentStatus.workflowType)}
• Uptime: ${uptimeMin}m ${uptimeSec}s
• MCP Tools: ${agentStatus.simpleFeatures?.mcpToolsAvailable || 0}`;
}
