import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { EmptyState } from './empty_state';

describe('EmptyState', () => {
  it('should render title and description', () => {
    render(<EmptyState description="Test description" title="Test Title" />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render default icon when no custom icon provided', () => {
    render(<EmptyState description="Description" title="Title" />);

    const svg = document.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('aria-hidden', 'true');
  });

  it('should render custom icon when provided', () => {
    const customIcon = <span data-testid="custom-icon">Custom Icon</span>;
    render(<EmptyState description="Description" icon={customIcon} title="Title" />);

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    // Default SVG should not be present
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });
});
