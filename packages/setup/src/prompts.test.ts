/**
 * Unit tests for prompts module
 *
 * Tests the non-interactive getCiConfig function which determines
 * default configuration for CI mode.
 */

import { describe, expect, it } from 'vitest';

import { getCiConfig } from './prompts.js';

describe('prompts', () => {
  describe('getCiConfig', () => {
    it('starts Docker when services not running', () => {
      const config = getCiConfig(false, false, false, false);
      expect(config.startDocker).toBe(true);
    });

    it('skips Docker when services already running', () => {
      const config = getCiConfig(true, false, false, false);
      expect(config.startDocker).toBe(false);
    });

    it('generates .env when it does not exist', () => {
      const config = getCiConfig(false, false, false, false);
      expect(config.generateEnv).toBe(true);
    });

    it('skips .env generation when it exists and no force', () => {
      const config = getCiConfig(false, true, false, false);
      expect(config.generateEnv).toBe(false);
    });

    it('regenerates .env when force=true even if exists', () => {
      const config = getCiConfig(false, true, false, true);
      expect(config.generateEnv).toBe(true);
      expect(config.envOverwrite).toBe(true);
    });

    it('always creates user in CI mode', () => {
      const config = getCiConfig(false, false, false, false);
      expect(config.createUser).toBe(true);
    });

    it('does not set custom password in CI mode', () => {
      const config = getCiConfig(false, false, false, false);
      expect(config.userPassword).toBeUndefined();
    });

    it('skips agent image build in CI (saves time)', () => {
      const config = getCiConfig(false, false, false, false);
      expect(config.buildAgentImage).toBe(false);
    });

    it('installs pi skills when pi is installed', () => {
      const config = getCiConfig(false, false, true, false);
      expect(config.installPiSkills).toBe(true);
    });

    it('skips pi skills when pi is not installed', () => {
      const config = getCiConfig(false, false, false, false);
      expect(config.installPiSkills).toBe(false);
    });

    it('returns complete config object', () => {
      const config = getCiConfig(false, false, false, false);

      expect(config).toHaveProperty('startDocker');
      expect(config).toHaveProperty('generateEnv');
      expect(config).toHaveProperty('envOverwrite');
      expect(config).toHaveProperty('createUser');
      expect(config).toHaveProperty('userPassword');
      expect(config).toHaveProperty('buildAgentImage');
      expect(config).toHaveProperty('installPiSkills');
    });
  });
});
