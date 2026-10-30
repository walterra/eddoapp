import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TodosView, type TodosViewProps } from './todos_view';

const fixture = vi.hoisted(() => ({ assistant: vi.fn() }));
vi.mock('./audit_sidebar', () => ({ AuditSidebar: () => <div>Activity sidebar</div> }));
vi.mock('./health_indicator_popover', () => ({ HealthIndicatorPopover: () => null }));
vi.mock('./search_popover', () => ({ SearchPopover: () => null }));
vi.mock('./chat', () => ({ ChatSidebar: () => null }));
vi.mock('./assistant/assistant_sidebar', () => ({
  AssistantSidebar: () => {
    fixture.assistant();
    return <div>Shared assistant panel</div>;
  },
}));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function props(): TodosViewProps {
  return {
    children: <div>Todos stay mounted</div>,
    isAuthenticated: true,
    logout: vi.fn(),
    onShowChat: vi.fn(),
    onShowProfile: vi.fn(),
    activitySidebar: { isOpen: true, toggle: vi.fn(), setOpen: vi.fn() },
    assistantSidebar: { isOpen: false, toggle: vi.fn(), close: vi.fn() },
    chatSidebar: {
      isOpen: false,
      selectedSessionId: null,
      setOpen: vi.fn(),
      setSession: vi.fn(),
      open: vi.fn(),
      close: vi.fn(),
    },
    onExpandChat: vi.fn(),
    databaseName: 'test',
    healthCheck: null,
    onSelectTodo: vi.fn(),
  };
}

describe('main app assistant sidebar integration', () => {
  it('keeps assistant visibility separate from activity and sandbox controls', async () => {
    const options = props();
    const view = render(<TodosView {...options} />);
    const toggle = screen.getByRole('button', { name: 'Show assistant' });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.assistant).not.toHaveBeenCalled();
    fireEvent.click(toggle);
    expect(options.assistantSidebar.toggle).toHaveBeenCalledOnce();
    expect(options.onShowChat).not.toHaveBeenCalled();
    expect(options.activitySidebar.toggle).not.toHaveBeenCalled();
    view.rerender(
      <TodosView {...options} assistantSidebar={{ ...options.assistantSidebar, isOpen: true }} />,
    );
    expect(await screen.findByText('Shared assistant panel')).toBeTruthy();
    expect(screen.getByText('Activity sidebar')).toBeTruthy();
    expect(screen.getByText('Todos stay mounted')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Hide assistant' }).getAttribute('aria-expanded'),
    ).toBe('true');
  });
});
