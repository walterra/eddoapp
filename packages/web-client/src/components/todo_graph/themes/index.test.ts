import { describe, expect, it } from 'vitest';

import { getAvailableThemeIds, getAvailableThemes, loadTheme } from './index';

describe('graph theme registry', () => {
  it('registers dependency canvas theme for programmatic loading', () => {
    expect(getAvailableThemeIds()).toContain('dependency_canvas');
  });

  it('loads dependency canvas theme by id', async () => {
    const theme = await loadTheme('dependency_canvas');

    expect(theme.id).toBe('dependency_canvas');
    expect(theme.classPrefix).toBe('theme-dependency-canvas');
    expect(theme.layout).toBe('graphviz');
  });

  it('keeps selector metadata focused on user-selectable themes', () => {
    const themeIds = getAvailableThemes().map((theme) => theme.id);

    expect(themeIds).toContain('default');
    expect(themeIds).toContain('rpg2');
    expect(themeIds).not.toContain('dependency_canvas');
  });
});
