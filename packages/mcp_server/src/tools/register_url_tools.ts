import type { ToolRegistry } from '../tool_registry.js';
import { executeFetchUrl, fetchUrlDescription, fetchUrlParameters } from './fetch_url.js';
import { wrapToolExecution } from './tool-wrapper.js';

/** Registers public-page extraction without granting browser or filesystem access. */
export function registerUrlTools(server: ToolRegistry): void {
  server.addTool({
    name: 'fetchUrl',
    description: fetchUrlDescription,
    parameters: fetchUrlParameters,
    execute: wrapToolExecution('fetchUrl', executeFetchUrl),
  });
}
