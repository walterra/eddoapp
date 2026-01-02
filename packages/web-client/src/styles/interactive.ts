/**
 * Shared interactive element styles for consistent hover/focus states
 */

/** Base focus ring styles for keyboard accessibility */
export const FOCUS_RING =
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800';

/** Focus ring without offset (for elements with backgrounds) */
export const FOCUS_RING_INSET =
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset';

/** Standard transition for interactive elements */
export const TRANSITION = 'transition-colors duration-200';

/** Filter dropdown trigger button - inactive state */
export const FILTER_BUTTON_INACTIVE = `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TRANSITION} border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${FOCUS_RING}`;

/** Filter dropdown trigger button - active state */
export const FILTER_BUTTON_ACTIVE = `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TRANSITION} border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900 dark:text-primary-300 dark:hover:bg-primary-800 ${FOCUS_RING}`;

/** Dropdown list item button */
export const DROPDOWN_ITEM = `block w-full rounded px-2 py-1 text-left text-sm ${TRANSITION} hover:bg-neutral-100 dark:hover:bg-neutral-700 ${FOCUS_RING_INSET}`;

/** Dropdown list item button - selected state additions */
export const DROPDOWN_ITEM_SELECTED =
  'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';

/** Dropdown list item button - unselected state additions */
export const DROPDOWN_ITEM_UNSELECTED = 'text-neutral-700 dark:text-neutral-300';

/** Icon button (small action buttons like edit, play/pause) */
export const ICON_BUTTON = `rounded p-1 ${TRANSITION} text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 ${FOCUS_RING}`;

/** Icon button that appears on hover (for todo cards) */
export const ICON_BUTTON_REVEAL = `${ICON_BUTTON} opacity-0 group-hover:opacity-100 focus:opacity-100`;

/** Text link styles */
export const TEXT_LINK = `${TRANSITION} text-primary-600 hover:text-primary-800 hover:underline dark:text-primary-400 dark:hover:text-primary-200 ${FOCUS_RING}`;

/** Clear/reset button in dropdowns */
export const CLEAR_BUTTON = `text-xs ${TRANSITION} text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200 ${FOCUS_RING} rounded`;

/** Card hover state for todo items */
export const CARD_HOVER = `${TRANSITION} hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600`;

/** Helper to combine dropdown item with selection state */
export const getDropdownItemClass = (isSelected: boolean): string =>
  `${DROPDOWN_ITEM} ${isSelected ? DROPDOWN_ITEM_SELECTED : DROPDOWN_ITEM_UNSELECTED}`;

/** Helper to get filter button class based on active state */
export const getFilterButtonClass = (isActive: boolean): string =>
  isActive ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE;
