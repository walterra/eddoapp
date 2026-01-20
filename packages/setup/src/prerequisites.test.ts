/**
 * Unit tests for prerequisites module
 *
 * Tests pure utility functions. Functions that call execSync are tested
 * via integration tests where they run against the real environment.
 */

import { describe, expect, it } from 'vitest';

import { extractVersion, isVersionAtLeast } from './prerequisites.js';

describe('prerequisites', () => {
  describe('extractVersion', () => {
    it('extracts version from "v22.12.0" format', () => {
      expect(extractVersion('v22.12.0')).toBe('22.12.0');
    });

    it('extracts version from "22.12.0" format without v prefix', () => {
      expect(extractVersion('22.12.0')).toBe('22.12.0');
    });

    it('extracts version from verbose output', () => {
      expect(extractVersion('Docker version 24.0.7, build afdd53b')).toBe('24.0.7');
    });

    it('extracts version from pnpm output', () => {
      expect(extractVersion('10.0.0')).toBe('10.0.0');
    });

    it('returns original string if no version pattern found', () => {
      expect(extractVersion('unknown')).toBe('unknown');
    });

    it('extracts version from git output', () => {
      expect(extractVersion('git version 2.39.3 (Apple Git-146)')).toBe('2.39.3');
    });
  });

  describe('isVersionAtLeast', () => {
    it('returns true when current equals minimum', () => {
      expect(isVersionAtLeast('18.11.0', '18.11.0')).toBe(true);
    });

    it('returns true when current major is higher', () => {
      expect(isVersionAtLeast('22.0.0', '18.11.0')).toBe(true);
    });

    it('returns true when current minor is higher', () => {
      expect(isVersionAtLeast('18.15.0', '18.11.0')).toBe(true);
    });

    it('returns true when current patch is higher', () => {
      expect(isVersionAtLeast('18.11.5', '18.11.0')).toBe(true);
    });

    it('returns false when current major is lower', () => {
      expect(isVersionAtLeast('16.0.0', '18.11.0')).toBe(false);
    });

    it('returns false when current minor is lower', () => {
      expect(isVersionAtLeast('18.10.0', '18.11.0')).toBe(false);
    });

    it('returns false when current patch is lower', () => {
      expect(isVersionAtLeast('18.11.0', '18.11.1')).toBe(false);
    });

    it('handles missing patch versions', () => {
      expect(isVersionAtLeast('22.12.0', '18.0.0')).toBe(true);
    });

    it('handles single digit versions', () => {
      expect(isVersionAtLeast('2.0.0', '1.0.0')).toBe(true);
      expect(isVersionAtLeast('1.0.0', '2.0.0')).toBe(false);
    });

    it('handles double digit minor versions', () => {
      expect(isVersionAtLeast('10.27.0', '10.25.0')).toBe(true);
      expect(isVersionAtLeast('10.25.0', '10.27.0')).toBe(false);
    });
  });
});
