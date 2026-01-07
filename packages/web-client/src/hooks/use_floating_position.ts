/**
 * Hook for positioning floating elements with automatic flip and shift
 * Uses @floating-ui/react for smart positioning that avoids viewport overflow
 */
import { autoUpdate, flip, offset, type Placement, shift, useFloating } from '@floating-ui/react';

interface UseFloatingPositionOptions {
  /** Preferred placement of the floating element */
  placement?: Placement;
  /** Offset from the reference element in pixels */
  offsetPx?: number;
  /** Whether the floating element is currently open */
  open: boolean;
}

/**
 * Provides smart positioning for floating elements like popovers and dropdowns.
 * Automatically flips placement when near viewport edges and shifts to stay visible.
 */
export function useFloatingPosition({
  placement = 'bottom-start',
  offsetPx = 4,
  open,
}: UseFloatingPositionOptions) {
  const { refs, floatingStyles } = useFloating({
    placement,
    open,
    middleware: [
      offset(offsetPx),
      flip({
        fallbackAxisSideDirection: 'end',
        padding: 8,
      }),
      shift({ padding: 8 }),
    ],
    whileElementsMounted: autoUpdate,
  });

  return {
    refs,
    floatingStyles,
  };
}
