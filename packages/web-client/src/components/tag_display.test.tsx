import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import '../test-polyfill';
import { TagDisplay } from './tag_display';

describe('TagDisplay', () => {
  describe('Basic rendering', () => {
    it('renders nothing when no tags provided', () => {
      const { container } = render(<TagDisplay tags={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders all tags when provided', () => {
      const tags = ['work', 'urgent', 'personal'];
      render(<TagDisplay tags={tags} />);

      tags.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });

    it('renders single tag correctly', () => {
      render(<TagDisplay tags={['work']} />);
      expect(screen.getByText('work')).toBeInTheDocument();
    });
  });

  describe('Size variants', () => {
    it('applies xs size classes by default', () => {
      render(<TagDisplay tags={['work']} />);
      const tag = screen.getByText('work');
      expect(tag).toHaveClass('px-1.5', 'py-0.5', 'text-xs');
    });

    it('applies xs size classes when explicitly set', () => {
      render(<TagDisplay size="xs" tags={['work']} />);
      const tag = screen.getByText('work');
      expect(tag).toHaveClass('px-1.5', 'py-0.5', 'text-xs');
    });

    it('applies sm size classes when specified', () => {
      render(<TagDisplay size="sm" tags={['work']} />);
      const tag = screen.getByText('work');
      expect(tag).toHaveClass('px-2', 'py-1', 'text-sm');
    });
  });

  describe('Tag truncation with maxTags', () => {
    const manyTags = ['tag1', 'tag2', 'tag3', 'tag4', 'tag5'];

    it('shows all tags when maxTags is not specified', () => {
      render(<TagDisplay tags={manyTags} />);

      manyTags.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });

    it('shows all tags when maxTags is greater than tag count', () => {
      render(<TagDisplay maxTags={10} tags={manyTags} />);

      manyTags.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('shows all tags when maxTags equals tag count', () => {
      render(<TagDisplay maxTags={5} tags={manyTags} />);

      manyTags.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('truncates tags when maxTags is less than tag count', () => {
      render(<TagDisplay maxTags={3} tags={manyTags} />);

      // Should show first 3 tags
      expect(screen.getByText('tag1')).toBeInTheDocument();
      expect(screen.getByText('tag2')).toBeInTheDocument();
      expect(screen.getByText('tag3')).toBeInTheDocument();

      // Should not show remaining tags
      expect(screen.queryByText('tag4')).not.toBeInTheDocument();
      expect(screen.queryByText('tag5')).not.toBeInTheDocument();

      // Should show remaining count
      expect(screen.getByText('+2')).toBeInTheDocument();
    });

    it('shows correct remaining count for different maxTags values', () => {
      const { rerender } = render(<TagDisplay maxTags={1} tags={manyTags} />);
      expect(screen.getByText('+4')).toBeInTheDocument();

      rerender(<TagDisplay maxTags={2} tags={manyTags} />);
      expect(screen.getByText('+3')).toBeInTheDocument();

      rerender(<TagDisplay maxTags={4} tags={manyTags} />);
      expect(screen.getByText('+1')).toBeInTheDocument();
    });

    it('applies correct size classes to remaining count indicator', () => {
      render(<TagDisplay maxTags={2} size="sm" tags={manyTags} />);
      const remainingCount = screen.getByText('+3');
      expect(remainingCount).toHaveClass('px-2', 'py-1', 'text-sm');
    });

    it('applies correct styling to remaining count indicator', () => {
      render(<TagDisplay maxTags={2} tags={manyTags} />);
      const remainingCount = screen.getByText('+3');
      expect(remainingCount).toHaveClass(
        'bg-gray-100',
        'text-gray-600',
        'rounded-full',
        'font-medium',
      );
    });
  });

  describe('Styling', () => {
    it('applies correct base styling to tags', () => {
      render(<TagDisplay tags={['work']} />);
      const tag = screen.getByText('work');
      expect(tag).toHaveClass(
        'inline-flex',
        'items-center',
        'rounded-full',
        'bg-blue-100',
        'font-medium',
        'text-blue-800',
      );
    });

    it('applies dark mode classes to tags', () => {
      render(<TagDisplay tags={['work']} />);
      const tag = screen.getByText('work');
      expect(tag).toHaveClass('dark:bg-blue-900', 'dark:text-blue-300');
    });

    it('applies correct layout classes to container', () => {
      render(<TagDisplay tags={['work', 'urgent']} />);
      const container = screen.getByText('work').parentElement;
      expect(container).toHaveClass('flex', 'flex-wrap', 'gap-1');
    });
  });

  describe('Edge cases', () => {
    it('handles single tag with maxTags of 0 (treats as unlimited)', () => {
      render(<TagDisplay maxTags={0} tags={['work']} />);
      expect(screen.getByText('work')).toBeInTheDocument();
      expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
    });

    it('handles empty tags array with maxTags', () => {
      const { container } = render(<TagDisplay maxTags={5} tags={[]} />);
      expect(container.firstChild).toBeNull();
    });

    it('handles very long tag names', () => {
      const longTag = 'very-long-tag-name-that-might-cause-layout-issues';
      render(<TagDisplay tags={[longTag]} />);
      expect(screen.getByText(longTag)).toBeInTheDocument();
    });

    it('handles special characters in tag names', () => {
      const specialTags = ['tag@symbol', 'tag#hash', 'tag$dollar', 'tag&amp'];
      render(<TagDisplay tags={specialTags} />);

      specialTags.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });

    it('handles numeric tag values', () => {
      const numericTags = ['123', '456', '789'];
      render(<TagDisplay tags={numericTags} />);

      numericTags.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });
  });

  describe('Performance considerations', () => {
    it('handles large number of tags efficiently', () => {
      const largeTags = Array.from({ length: 100 }, (_, i) => `tag${i}`);
      render(<TagDisplay maxTags={5} tags={largeTags} />);

      // Should only render 5 tags plus the remaining count
      expect(screen.getByText('tag0')).toBeInTheDocument();
      expect(screen.getByText('tag4')).toBeInTheDocument();
      expect(screen.getByText('+95')).toBeInTheDocument();
      expect(screen.queryByText('tag5')).not.toBeInTheDocument();
    });
  });
});
