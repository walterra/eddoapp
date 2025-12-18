import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ViewModeToggle } from './view_mode_toggle';

describe('ViewModeToggle Component', () => {
  it('renders both kanban and table buttons', () => {
    render(<ViewModeToggle onViewModeChange={vi.fn()} viewMode="kanban" />);

    expect(screen.getByTitle('Kanban View')).toBeInTheDocument();
    expect(screen.getByTitle('Table View')).toBeInTheDocument();
  });

  it('highlights active view (kanban)', () => {
    render(<ViewModeToggle onViewModeChange={vi.fn()} viewMode="kanban" />);

    const kanbanButton = screen.getByTitle('Kanban View');
    const tableButton = screen.getByTitle('Table View');

    expect(kanbanButton).toHaveClass('bg-blue-100');
    expect(tableButton).not.toHaveClass('bg-blue-100');
  });

  it('highlights active view (table)', () => {
    render(<ViewModeToggle onViewModeChange={vi.fn()} viewMode="table" />);

    const kanbanButton = screen.getByTitle('Kanban View');
    const tableButton = screen.getByTitle('Table View');

    expect(tableButton).toHaveClass('bg-blue-100');
    expect(kanbanButton).not.toHaveClass('bg-blue-100');
  });

  it('calls onViewModeChange when kanban button clicked', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();

    render(<ViewModeToggle onViewModeChange={onViewModeChange} viewMode="table" />);

    const kanbanButton = screen.getByTitle('Kanban View');
    await user.click(kanbanButton);

    expect(onViewModeChange).toHaveBeenCalledWith('kanban');
    expect(onViewModeChange).toHaveBeenCalledTimes(1);
  });

  it('calls onViewModeChange when table button clicked', async () => {
    const user = userEvent.setup();
    const onViewModeChange = vi.fn();

    render(<ViewModeToggle onViewModeChange={onViewModeChange} viewMode="kanban" />);

    const tableButton = screen.getByTitle('Table View');
    await user.click(tableButton);

    expect(onViewModeChange).toHaveBeenCalledWith('table');
    expect(onViewModeChange).toHaveBeenCalledTimes(1);
  });

  it('disables buttons when loading', () => {
    render(<ViewModeToggle isLoading={true} onViewModeChange={vi.fn()} viewMode="kanban" />);

    const kanbanButton = screen.getByTitle('Kanban View');
    const tableButton = screen.getByTitle('Table View');

    expect(kanbanButton).toBeDisabled();
    expect(tableButton).toBeDisabled();
  });

  it('enables buttons when not loading', () => {
    render(<ViewModeToggle isLoading={false} onViewModeChange={vi.fn()} viewMode="kanban" />);

    const kanbanButton = screen.getByTitle('Kanban View');
    const tableButton = screen.getByTitle('Table View');

    expect(kanbanButton).not.toBeDisabled();
    expect(tableButton).not.toBeDisabled();
  });
});
