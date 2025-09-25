import '@testing-library/jest-dom';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import '../test-polyfill';
import { TagInput } from './tag_input';

describe('TagInput', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders with placeholder text when no tags', () => {
      render(<TagInput onChange={mockOnChange} tags={[]} />);
      expect(screen.getByPlaceholderText('Add tags...')).toBeInTheDocument();
    });

    it('renders with custom placeholder', () => {
      render(
        <TagInput
          onChange={mockOnChange}
          placeholder="Custom placeholder"
          tags={[]}
        />,
      );
      expect(
        screen.getByPlaceholderText('Custom placeholder'),
      ).toBeInTheDocument();
    });

    it('displays existing tags', () => {
      render(<TagInput onChange={mockOnChange} tags={['work', 'urgent']} />);
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.getByText('urgent')).toBeInTheDocument();
    });

    it('hides placeholder when tags exist', () => {
      render(<TagInput onChange={mockOnChange} tags={['work']} />);
      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder', '');
    });
  });

  describe('Tag addition', () => {
    it('adds tag when Enter is pressed', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={[]} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'newtag');
      await user.keyboard('{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
    });

    it('trims whitespace when adding tags', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={[]} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '  newtag  ');
      await user.keyboard('{Enter}');

      expect(mockOnChange).toHaveBeenCalledWith(['newtag']);
    });

    it('does not add empty tags', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={[]} />);

      const input = screen.getByRole('textbox');
      await user.type(input, '   ');
      await user.keyboard('{Enter}');

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('does not add duplicate tags', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={['existing']} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'existing');
      await user.keyboard('{Enter}');

      expect(mockOnChange).not.toHaveBeenCalled();
    });

    it('clears input after adding tag', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={[]} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'newtag');
      await user.keyboard('{Enter}');

      expect(input).toHaveValue('');
    });
  });

  describe('Tag removal', () => {
    it('removes tag when remove button is clicked', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={['work', 'urgent']} />);

      const removeButtons = screen.getAllByText('×');
      await user.click(removeButtons[0]);

      expect(mockOnChange).toHaveBeenCalledWith(['urgent']);
    });

    it('removes last tag when backspace is pressed with empty input', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={['work', 'urgent']} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('{Backspace}');

      expect(mockOnChange).toHaveBeenCalledWith(['work']);
    });

    it('does not remove tag when backspace is pressed with input value', async () => {
      const user = userEvent.setup();
      render(<TagInput onChange={mockOnChange} tags={['work']} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');
      await user.keyboard('{Backspace}');

      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Suggestions functionality', () => {
    const suggestions = ['work', 'urgent', 'personal', 'project'];

    it('shows suggestions when typing', async () => {
      const user = userEvent.setup();
      render(
        <TagInput
          onChange={mockOnChange}
          suggestions={suggestions}
          tags={[]}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'wo');

      expect(screen.getByText('work')).toBeInTheDocument();
    });

    it('filters suggestions based on input', async () => {
      const user = userEvent.setup();
      render(
        <TagInput
          onChange={mockOnChange}
          suggestions={suggestions}
          tags={[]}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'urg');

      expect(screen.getByText('urgent')).toBeInTheDocument();
      expect(screen.queryByText('work')).not.toBeInTheDocument();
    });

    it('excludes already selected tags from suggestions', async () => {
      const user = userEvent.setup();
      render(
        <TagInput
          onChange={mockOnChange}
          suggestions={suggestions}
          tags={['work']}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'w');

      // The existing tag 'work' should be displayed as a selected tag
      // but not in the suggestions dropdown
      const suggestionButtons = screen.queryAllByRole('button');
      const workSuggestion = suggestionButtons.find(
        (button) =>
          button.textContent === 'work' && !button.textContent?.includes('×'),
      );
      expect(workSuggestion).toBeUndefined();
    });

    it('adds tag when suggestion is clicked', async () => {
      const user = userEvent.setup();

      render(
        <TagInput
          onChange={mockOnChange}
          suggestions={suggestions}
          tags={[]}
        />,
      );

      const input = screen.getByRole('textbox');

      // Type 'w' first to get suggestions
      await user.type(input, 'w');

      // Wait for suggestions to appear and verify they're clickable
      await waitFor(() => {
        const suggestionButtons = screen.queryAllByRole('button');
        const workButton = suggestionButtons.find(
          (btn) =>
            btn.textContent === 'work' && btn.className.includes('w-full'),
        );
        expect(workButton).toBeDefined();
      });

      // Now click the suggestion
      const workButton = screen.getByRole('button', { name: 'work' });
      await user.click(workButton);

      expect(mockOnChange).toHaveBeenCalledWith(['work']);
    });

    it('shows maximum 5 suggestions', async () => {
      const user = userEvent.setup();
      const manySuggestions = Array.from({ length: 10 }, (_, i) => `tag${i}`);
      render(
        <TagInput
          onChange={mockOnChange}
          suggestions={manySuggestions}
          tags={[]}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'tag');

      const suggestionButtons = screen.getAllByRole('button');
      // Subtract 1 for the input container which might be detected as a button
      expect(suggestionButtons.length).toBeLessThanOrEqual(5);
    });

    it('shows suggestions on focus if input has value', async () => {
      const user = userEvent.setup();
      render(
        <TagInput
          onChange={mockOnChange}
          suggestions={suggestions}
          tags={[]}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'wo');
      await user.click(document.body); // Blur input
      await user.click(input); // Focus again

      expect(screen.getByText('work')).toBeInTheDocument();
    });

    it('hides suggestions when Escape is pressed', async () => {
      const user = userEvent.setup();
      render(
        <TagInput
          onChange={mockOnChange}
          suggestions={suggestions}
          tags={[]}
        />,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'wo');
      expect(screen.getByText('work')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByText('work')).not.toBeInTheDocument();
    });
  });

  describe('Keyboard navigation', () => {
    it('prevents default on Enter key', async () => {
      const user = userEvent.setup();
      const form = document.createElement('form');
      const onSubmit = vi.fn();
      form.onsubmit = onSubmit;

      render(<TagInput onChange={mockOnChange} tags={[]} />, {
        container: document.body.appendChild(form),
      });

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');
      await user.keyboard('{Enter}');

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('Click outside behavior', () => {
    it('hides suggestions when clicking outside', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <TagInput onChange={mockOnChange} suggestions={['work']} tags={[]} />
          <div data-testid="outside">Outside element</div>
        </div>,
      );

      const input = screen.getByRole('textbox');
      await user.type(input, 'wo');
      expect(screen.getByText('work')).toBeInTheDocument();

      await user.click(screen.getByTestId('outside'));
      expect(screen.queryByText('work')).not.toBeInTheDocument();
    });
  });
});
