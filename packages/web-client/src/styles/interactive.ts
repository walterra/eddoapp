/**
 * Shared interactive element styles for consistent hover/focus states.
 * Design tokens for visual consistency across the application.
 */

// =============================================================================
// FOUNDATION TOKENS
// =============================================================================

/** Base focus ring styles for keyboard accessibility */
export const FOCUS_RING =
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800';

/** Focus ring without offset (for elements with backgrounds) */
export const FOCUS_RING_INSET =
  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset';

/** Standard transition for interactive elements (buttons, cards) */
export const TRANSITION = 'transition-colors duration-200';

/** Fast transition for menu/dropdown items - keeps hover responsive when moving between items */
export const TRANSITION_FAST = 'transition-colors duration-75';

// =============================================================================
// BUTTON TOKENS
// =============================================================================

/** Primary action button (solid background) */
export const BTN_PRIMARY = `rounded-lg px-4 py-2 text-sm font-medium ${TRANSITION} bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING}`;

/** Secondary action button (outlined/gray) */
export const BTN_SECONDARY = `rounded-lg px-4 py-2 text-sm font-medium ${TRANSITION} border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING}`;

/** Ghost button (minimal, for tertiary actions) */
export const BTN_GHOST = `rounded-lg px-4 py-2 text-sm font-medium ${TRANSITION} text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING}`;

/** Small primary button variant */
export const BTN_PRIMARY_SM = `rounded-lg px-2 py-1 text-xs font-medium ${TRANSITION} bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ${FOCUS_RING}`;

// =============================================================================
// CARD TOKENS
// =============================================================================

/** Base card styles (static container) */
export const CARD_BASE =
  'rounded-lg border border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-800';

/** Interactive card with hover effects (for todo items) */
export const CARD_INTERACTIVE = `${CARD_BASE} ${TRANSITION} hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600`;

/** Card hover state (legacy, use CARD_INTERACTIVE instead) */
export const CARD_HOVER = `${TRANSITION} hover:shadow-md hover:border-neutral-300 dark:hover:border-neutral-600`;

// =============================================================================
// DROPDOWN/POPOVER TOKENS
// =============================================================================

/** Dropdown container (floating panel) */
export const DROPDOWN_CONTAINER =
  'absolute z-20 mt-1 max-h-96 overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-600 dark:bg-neutral-800';

/** Filter dropdown trigger button - inactive state */
export const FILTER_BUTTON_INACTIVE = `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TRANSITION} border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700 ${FOCUS_RING}`;

/** Filter dropdown trigger button - active state */
export const FILTER_BUTTON_ACTIVE = `flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${TRANSITION} border-primary-500 bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900 dark:text-primary-300 dark:hover:bg-primary-800 ${FOCUS_RING}`;

/** Dropdown list item button */
export const DROPDOWN_ITEM = `block w-full rounded px-2 py-1 text-left text-sm ${TRANSITION_FAST} hover:bg-neutral-100 dark:hover:bg-neutral-700 ${FOCUS_RING_INSET}`;

/** Dropdown list item button - selected state additions */
export const DROPDOWN_ITEM_SELECTED =
  'bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-200';

/** Dropdown list item button - unselected state additions */
export const DROPDOWN_ITEM_UNSELECTED = 'text-neutral-700 dark:text-neutral-300';

// =============================================================================
// ICON BUTTON TOKENS
// =============================================================================

/** Icon button (small action buttons like edit, play/pause) */
export const ICON_BUTTON = `rounded p-1 ${TRANSITION} text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-200 dark:hover:bg-neutral-700 ${FOCUS_RING}`;

/** Icon button that appears on hover (for todo cards) */
export const ICON_BUTTON_REVEAL = `${ICON_BUTTON} opacity-0 group-hover:opacity-100 focus:opacity-100`;

// =============================================================================
// TEXT/LINK TOKENS
// =============================================================================

/** Text link styles */
export const TEXT_LINK = `${TRANSITION} text-primary-600 hover:text-primary-800 hover:underline dark:text-primary-400 dark:hover:text-primary-200 ${FOCUS_RING}`;

/** Clear/reset button in dropdowns */
export const CLEAR_BUTTON = `text-xs ${TRANSITION} text-primary-600 hover:text-primary-800 dark:text-primary-400 dark:hover:text-primary-200 ${FOCUS_RING} rounded`;

// =============================================================================
// INPUT TOKENS
// =============================================================================

/** Base input field styles */
export const INPUT_BASE = `rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm ${TRANSITION} dark:border-neutral-600 dark:bg-neutral-700 dark:text-neutral-300 focus:border-primary-500 focus:ring-2 focus:ring-primary-500 focus:ring-opacity-50`;

// =============================================================================
// TOGGLE BUTTON GROUP TOKENS
// =============================================================================

/** Toggle button group container */
export const TOGGLE_GROUP = `flex items-center gap-1 rounded-lg border border-neutral-300 bg-white p-1 dark:border-neutral-600 dark:bg-neutral-800`;

/** Toggle button - active state */
export const TOGGLE_BUTTON_ACTIVE = `flex items-center gap-1 rounded px-2 py-1 text-sm ${TRANSITION} bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 ${FOCUS_RING_INSET}`;

/** Toggle button - inactive state */
export const TOGGLE_BUTTON_INACTIVE = `flex items-center gap-1 rounded px-2 py-1 text-sm ${TRANSITION} text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700 ${FOCUS_RING_INSET}`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/** Combine dropdown item with selection state */
export const getDropdownItemClass = (isSelected: boolean): string =>
  `${DROPDOWN_ITEM} ${isSelected ? DROPDOWN_ITEM_SELECTED : DROPDOWN_ITEM_UNSELECTED}`;

/** Get filter button class based on active state */
export const getFilterButtonClass = (isActive: boolean): string =>
  isActive ? FILTER_BUTTON_ACTIVE : FILTER_BUTTON_INACTIVE;

/** Get toggle button class based on active state */
export const getToggleButtonClass = (isActive: boolean): string =>
  isActive ? TOGGLE_BUTTON_ACTIVE : TOGGLE_BUTTON_INACTIVE;
