import { getPersona } from '../ai/personas.js';
import { appConfig } from '../utils/config.js';
import {
  buildToolsSection,
  getBulkOperationsSection,
  getCommunicationStyleSection,
  getContextAwarenessSection,
  getDateParsingSection,
  getMcpToolRulesSection,
  getMemoryHandlingSection,
  getNextActionSection,
  getResponseFormatSection,
  getUrlHandlingSection,
  getWorkRequestSection,
} from './system-prompt-sections.js';

interface ToolInfo {
  name: string;
  description: string;
}

function buildCurrentDateTime(): string {
  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  return `Current date and time: ${dayOfWeek}, ${now.toISOString()}`;
}

/**
 * Builds the complete system prompt for the AI agent
 * @param mcpServerInfo - MCP server connection information
 * @param tools - Available MCP tools
 * @returns Complete system prompt string
 */
export function buildSystemPrompt(mcpServerInfo: string, tools?: ToolInfo[]): string {
  const persona = getPersona(appConfig.BOT_PERSONA_ID);

  const sections = [
    persona.personalityPrompt,
    buildCurrentDateTime(),
    mcpServerInfo,
    buildToolsSection(tools),
    'To use a tool, respond with: TOOL_CALL: {"name": "toolName", "parameters": {...}}',
    getCommunicationStyleSection(),
    getDateParsingSection(),
    getMemoryHandlingSection(),
    getUrlHandlingSection(),
    getMcpToolRulesSection(),
    getBulkOperationsSection(),
    getWorkRequestSection(),
    getContextAwarenessSection(),
    getNextActionSection(),
    getResponseFormatSection(),
  ];

  return sections.join('\n\n');
}
