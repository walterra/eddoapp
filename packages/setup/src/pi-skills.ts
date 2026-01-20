/**
 * pi-coding-agent skills and extensions integration
 *
 * Re-exports from split modules for backward compatibility.
 */

import { execSync } from 'child_process';

// Re-export detection types and functions
export {
  checkEddoSkillsInstalled,
  getInstalledSkillNames,
  getInstallStatus,
  getPiExtensionsDir,
  getPiSkillsDir,
  parseSkillName,
  type ConflictInfo,
  type EddoSkillsStatus,
  type InstallStatus,
  type SkillInfo,
} from './pi-skills-detection.js';

// Re-export installation functions
export { displayConflicts, installEddoSkillsAndExtensions } from './pi-skills-install.js';

/**
 * Check if pi-coding-agent is installed globally via npm
 */
export function isPiCodingAgentInstalled(): { installed: boolean; version?: string } {
  try {
    const result = execSync('npm list -g @mariozechner/pi-coding-agent --json 2>/dev/null', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const parsed = JSON.parse(result);
    const deps = parsed.dependencies?.['@mariozechner/pi-coding-agent'];
    if (deps?.version) {
      return { installed: true, version: deps.version };
    }
    return { installed: false };
  } catch {
    return { installed: false };
  }
}
