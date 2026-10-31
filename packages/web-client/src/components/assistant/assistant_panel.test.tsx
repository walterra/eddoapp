import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssistantPanel } from './assistant_panel';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('docked assistant layout', () => {
  it.each([375, 1024, 1920])(
    'keeps the main view editable beside the assistant at %ipx',
    (width) => {
      vi.stubGlobal('innerWidth', width);
      const view = render(
        <div className="flex">
          <main>
            <label>
              Todo title
              <input defaultValue="Original task" />
            </label>
          </main>
          <AssistantPanel headingId="assistant-title" onClose={vi.fn()}>
            <h2 id="assistant-title">Assistant</h2>
            <label>
              Assistant draft
              <input />
            </label>
          </AssistantPanel>
        </div>,
      );
      const sidebar = screen.getByRole('complementary', { name: 'Assistant' });
      expect(sidebar.parentElement).toBe(screen.getByRole('main').parentElement);
      expect(view.container.contains(sidebar)).toBe(true);
      expect(document.querySelector('dialog, [aria-modal="true"]')).toBeNull();
      const todo = screen.getByRole('textbox', { name: 'Todo title' });
      todo.focus();
      fireEvent.change(todo, { target: { value: 'Edited beside assistant' } });
      expect(document.activeElement).toBe(todo);
      expect((todo as HTMLInputElement).value).toBe('Edited beside assistant');
      const composer = screen.getByRole('textbox', { name: 'Assistant draft' });
      composer.focus();
      fireEvent.change(composer, { target: { value: 'Continue planning' } });
      expect(document.activeElement).toBe(composer);
    },
  );
});
