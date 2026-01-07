/**
 * Tests for filter presets hook helpers
 */
import { describe, expect, it } from 'vitest';

import {
  type CreatePresetData,
  createFilterPreset,
  generatePresetId,
  presetToFilterState,
} from './use_filter_presets_helpers';
import type { FilterPreset } from './use_profile_types';

describe('useFilterPresets helpers', () => {
  describe('generatePresetId', () => {
    it('generates unique IDs', () => {
      const id1 = generatePresetId();
      const id2 = generatePresetId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^preset_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^preset_\d+_[a-z0-9]+$/);
    });

    it('includes timestamp prefix', () => {
      const before = Date.now();
      const id = generatePresetId();
      const after = Date.now();

      const timestampPart = parseInt(id.split('_')[1], 10);
      expect(timestampPart).toBeGreaterThanOrEqual(before);
      expect(timestampPart).toBeLessThanOrEqual(after);
    });
  });

  describe('createFilterPreset', () => {
    const baseData: CreatePresetData = {
      name: 'Test Preset',
      filters: {
        selectedTags: ['tag1', 'tag2'],
        selectedContexts: ['work'],
        selectedStatus: 'incomplete',
        selectedTimeRange: { type: 'current-week' },
        currentDate: new Date('2026-01-06T12:00:00.000Z'),
      },
      useRelativeDate: true,
    };

    it('creates preset with relative date mode', () => {
      const preset = createFilterPreset(baseData);

      expect(preset.name).toBe('Test Preset');
      expect(preset.selectedTags).toEqual(['tag1', 'tag2']);
      expect(preset.selectedContexts).toEqual(['work']);
      expect(preset.selectedStatus).toBe('incomplete');
      expect(preset.selectedTimeRange).toEqual({ type: 'current-week' });
      expect(preset.dateMode).toBe('relative');
      expect(preset.savedDate).toBeUndefined();
      expect(preset.id).toMatch(/^preset_/);
      expect(preset.createdAt).toBeDefined();
    });

    it('creates preset with fixed date mode', () => {
      const data: CreatePresetData = {
        ...baseData,
        useRelativeDate: false,
      };

      const preset = createFilterPreset(data);

      expect(preset.dateMode).toBe('fixed');
      expect(preset.savedDate).toBe('2026-01-06T12:00:00.000Z');
    });

    it('trims whitespace from name', () => {
      const data: CreatePresetData = {
        ...baseData,
        name: '  Trimmed Name  ',
      };

      const preset = createFilterPreset(data);

      expect(preset.name).toBe('Trimmed Name');
    });

    it('creates deep copies of arrays', () => {
      const preset = createFilterPreset(baseData);

      // Mutating original should not affect preset
      baseData.filters.selectedTags.push('tag3');
      baseData.filters.selectedContexts.push('home');

      expect(preset.selectedTags).toEqual(['tag1', 'tag2']);
      expect(preset.selectedContexts).toEqual(['work']);
    });
  });

  describe('presetToFilterState', () => {
    it('converts relative preset to filter state with current date', () => {
      const preset: FilterPreset = {
        id: 'test-id',
        name: 'Test',
        selectedTags: ['tag1'],
        selectedContexts: ['work'],
        selectedStatus: 'completed',
        selectedTimeRange: { type: 'current-day' },
        dateMode: 'relative',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const before = Date.now();
      const state = presetToFilterState(preset);
      const after = Date.now();

      expect(state.selectedTags).toEqual(['tag1']);
      expect(state.selectedContexts).toEqual(['work']);
      expect(state.selectedStatus).toBe('completed');
      expect(state.selectedTimeRange).toEqual({ type: 'current-day' });

      // Current date should be close to now
      expect(state.currentDate.getTime()).toBeGreaterThanOrEqual(before);
      expect(state.currentDate.getTime()).toBeLessThanOrEqual(after);
    });

    it('converts fixed preset to filter state with saved date', () => {
      const preset: FilterPreset = {
        id: 'test-id',
        name: 'Test',
        selectedTags: [],
        selectedContexts: [],
        selectedStatus: 'all',
        selectedTimeRange: { type: 'custom', startDate: '2025-10-01', endDate: '2025-12-31' },
        dateMode: 'fixed',
        savedDate: '2025-10-15T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const state = presetToFilterState(preset);

      expect(state.currentDate.toISOString()).toBe('2025-10-15T00:00:00.000Z');
      expect(state.selectedTimeRange).toEqual({
        type: 'custom',
        startDate: '2025-10-01',
        endDate: '2025-12-31',
      });
    });

    it('creates deep copies of arrays', () => {
      const preset: FilterPreset = {
        id: 'test-id',
        name: 'Test',
        selectedTags: ['tag1'],
        selectedContexts: ['work'],
        selectedStatus: 'all',
        selectedTimeRange: { type: 'current-week' },
        dateMode: 'relative',
        createdAt: '2026-01-01T00:00:00.000Z',
      };

      const state = presetToFilterState(preset);

      // Mutating state should not affect original preset
      state.selectedTags.push('tag2');
      state.selectedContexts.push('home');

      expect(preset.selectedTags).toEqual(['tag1']);
      expect(preset.selectedContexts).toEqual(['work']);
    });
  });
});
