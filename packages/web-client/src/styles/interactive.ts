/**
 * Shared interactive element styles for consistent hover/focus states
 */

/** Base focus ring styles for keyboard accessibility */
export const FOCUS_RING =
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800';

/** Focus ring without offset (for elements with backgrounds) */
export const FOCUS_RING_INSET =
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset';

/** Standard transition for interactive elements */
export const TRANSITION = 'transition-colors duration-200';

/** Filter dropdown trigger button - inactive state */
export const FILTER_BUTTON_INACTIVE = `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TRANSITION} border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 ${FOCUS_RING}`;

/** Filter dropdown trigger button - active state */
export const FILTER_BUTTON_ACTIVE = `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TRANSITION} border-blue-500 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300 dark:hover:bg-blue-800 ${FOCUS_RING}`;

/** Dropdown list item button */
export const DROPDOWN_ITEM = `block w-full rounded px-2 py-1 text-left text-sm ${TRANSITION} hover:bg-gray-100 dark:hover:bg-gray-700 ${FOCUS_RING_INSET}`;

/** Dropdown list item button - selected state additions */
export const DROPDOWN_ITEM_SELECTED =
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';

/** Dropdown list item button - unselected state additions */
export const DROPDOWN_ITEM_UNSELECTED = 'text-gray-700 dark:text-gray-300';

/** Icon button (small action buttons like edit, play/pause) */
export const ICON_BUTTON = `rounded p-1 ${TRANSITION} text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 ${FOCUS_RING}`;

/** Icon button that appears on hover (for todo cards) */
export const ICON_BUTTON_REVEAL = `${ICON_BUTTON} opacity-0 group-hover:opacity-100 focus:opacity-100`;

/** Text link styles */
export const TEXT_LINK = `${TRANSITION} text-blue-600 hover:text-blue-800 hover:underline dark:text-blue-400 dark:hover:text-blue-200 ${FOCUS_RING}`;

/** Clear/reset button in dropdowns */
export const CLEAR_BUTTON = `text-xs ${TRANSITION} text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200 ${FOCUS_RING} rounded`;

/** Card hover state for todo items */
export const CARD_HOVER = `${TRANSITION} hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600`;

/** Helper to combine dropdown item with selection state */
export const getDropdownItemClass = (isSelected: boolean): string =>
  `${DROPDOWN_ITEM} ${isSelected ? DROPDOWN_ITEM_SELECTED : DROPDOWN_ITEM_UNSELECTED}`;

/** Helper to get filter button class based on active state */
export const getFilterButtonClass = (isActive: boolean): string =>
  isActive ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE;
