/**
 * @eddo/setup - Development environment setup utilities
 */

// Docker utilities
export {
  buildPiCodingAgentImage,
  isContainerRunning,
  isCouchDBHealthy,
  isElasticsearchHealthy,
  isPiCodingAgentImageExists,
  startDockerServices,
  waitForService,
} from './docker.js';

// Display utilities
export {
  displayConfigStatus,
  displayDockerStatus,
  displayPiCodingAgentStatus,
  displaySummary,
} from './display.js';

// Environment file utilities
export { envFileExists, generateEnvFile } from './env.js';

// pi-coding-agent integration
export {
  checkEddoSkillsInstalled,
  getPiExtensionsDir,
  getPiSkillsDir,
  installEddoSkillsAndExtensions,
  isPiCodingAgentInstalled,
  type EddoSkillsStatus,
  type SkillInfo,
} from './pi-skills.js';

// Prerequisites checking
export {
  checkPrerequisites,
  checkVersionedPrerequisite,
  displayPrerequisites,
  execCommand,
  extractVersion,
  isDockerRunning,
  isVersionAtLeast,
  type PrerequisiteResult,
} from './prerequisites.js';

// Interactive prompts
export { getCiConfig, promptForOptions, type PromptOptions } from './prompts.js';

// Types
export { type SetupConfig, type SetupOptions } from './types.js';

// Workspace utilities
export {
  buildWorkspacePackages,
  checkDefaultUserExists,
  createDefaultUser,
  ensureLogsDirectory,
} from './workspace.js';
