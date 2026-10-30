import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useAssistantSidebar } from './use_assistant_sidebar';

const fixture = vi.hoisted(() => ({ username: 'alice' as string | undefined }));
vi.mock('./use_auth', () => ({ useAuth: () => ({ username: fixture.username }) }));

describe('independent assistant visibility', () => {
  it('starts closed and resets visibility across account changes', () => {
    fixture.username = 'alice';
    const view = renderHook(() => useAssistantSidebar());
    expect(view.result.current.isOpen).toBe(false);
    act(() => view.result.current.toggle());
    expect(view.result.current.isOpen).toBe(true);
    fixture.username = 'bob';
    view.rerender();
    expect(view.result.current.isOpen).toBe(false);
    fixture.username = 'alice';
    view.rerender();
    expect(view.result.current.isOpen).toBe(false);
    act(() => view.result.current.toggle());
    act(() => view.result.current.close());
    expect(view.result.current.isOpen).toBe(false);
    view.unmount();
  });
});
