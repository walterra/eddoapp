import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ColumnPicker } from './column_picker';

describe('ColumnPicker Component', () => {
  const defaultColumns = ['title', 'context', 'due'];

  it('renders with column count', () => {
    render(<ColumnPicker onColumnsChange={vi.fn()} selectedColumns={defaultColumns} />);

    expect(screen.getByText(/Columns \(3\/11\)/)).toBeInTheDocument();
  });

  it('opens dropdown when clicked', async () => {
    const user = userEvent.setup();
    render(<ColumnPicker onColumnsChange={vi.fn()} selectedColumns={defaultColumns} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('Visible Columns')).toBeInTheDocument();
    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
  });

  it('shows all available column options', async () => {
    const user = userEvent.setup();
    render(<ColumnPicker onColumnsChange={vi.fn()} selectedColumns={defaultColumns} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('Title')).toBeInTheDocument();
    expect(screen.getByText('Subtasks')).toBeInTheDocument();
    expect(screen.getByText('Context')).toBeInTheDocument();
    expect(screen.getByText('Due Date')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
    expect(screen.getByText('Time Tracked')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Completed Date')).toBeInTheDocument();
    expect(screen.getByText('Repeat')).toBeInTheDocument();
    expect(screen.getByText('Link')).toBeInTheDocument();
    expect(screen.getByText('Description')).toBeInTheDocument();
  });

  it('checks selected columns', async () => {
    const user = userEvent.setup();
    render(<ColumnPicker onColumnsChange={vi.fn()} selectedColumns={defaultColumns} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const checkboxes = screen.getAllByRole('checkbox');
    const titleCheckbox = checkboxes.find((cb) => cb.parentElement?.textContent?.includes('Title'));
    const contextCheckbox = checkboxes.find((cb) =>
      cb.parentElement?.textContent?.includes('Context'),
    );
    const tagsCheckbox = checkboxes.find((cb) => cb.parentElement?.textContent?.includes('Tags'));

    expect(titleCheckbox).toBeChecked();
    expect(contextCheckbox).toBeChecked();
    expect(tagsCheckbox).not.toBeChecked();
  });

  it('calls onColumnsChange when column selected', async () => {
    const user = userEvent.setup();
    const onColumnsChange = vi.fn();
    render(<ColumnPicker onColumnsChange={onColumnsChange} selectedColumns={defaultColumns} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const checkboxes = screen.getAllByRole('checkbox');
    const tagsCheckbox = checkboxes.find((cb) => cb.parentElement?.textContent?.includes('Tags'));

    if (tagsCheckbox) {
      await user.click(tagsCheckbox);
      expect(onColumnsChange).toHaveBeenCalledWith(['title', 'context', 'due', 'tags']);
    }
  });

  it('calls onColumnsChange when column deselected', async () => {
    const user = userEvent.setup();
    const onColumnsChange = vi.fn();
    render(<ColumnPicker onColumnsChange={onColumnsChange} selectedColumns={defaultColumns} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const checkboxes = screen.getAllByRole('checkbox');
    const contextCheckbox = checkboxes.find((cb) =>
      cb.parentElement?.textContent?.includes('Context'),
    );

    if (contextCheckbox) {
      await user.click(contextCheckbox);
      expect(onColumnsChange).toHaveBeenCalledWith(['title', 'due']);
    }
  });

  it('prevents deselecting last column', async () => {
    const user = userEvent.setup();
    const onColumnsChange = vi.fn();
    render(<ColumnPicker onColumnsChange={onColumnsChange} selectedColumns={['title']} />);

    const button = screen.getByRole('button');
    await user.click(button);

    const checkboxes = screen.getAllByRole('checkbox');
    const titleCheckbox = checkboxes.find((cb) => cb.parentElement?.textContent?.includes('Title'));

    expect(titleCheckbox).toBeDisabled();
    expect(screen.getByText('At least one column must be visible')).toBeInTheDocument();

    if (titleCheckbox) {
      await user.click(titleCheckbox);
      expect(onColumnsChange).not.toHaveBeenCalled();
    }
  });

  it('closes dropdown when clicking outside', async () => {
    const user = userEvent.setup();
    render(<ColumnPicker onColumnsChange={vi.fn()} selectedColumns={defaultColumns} />);

    const button = screen.getByRole('button');
    await user.click(button);

    expect(screen.getByText('Visible Columns')).toBeInTheDocument();

    // Click outside (on the overlay)
    const overlay = document.querySelector('.fixed.inset-0');
    if (overlay) {
      await user.click(overlay);
      expect(screen.queryByText('Visible Columns')).not.toBeInTheDocument();
    }
  });
});
