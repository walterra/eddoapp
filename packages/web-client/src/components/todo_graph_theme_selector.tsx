/**
 * Theme selector dropdown for the graph view.
 * Uses theme metadata for instant UI updates while themes load lazily.
 */
import { type FC, useState } from 'react';
import { HiChevronDown, HiColorSwatch } from 'react-icons/hi';

import { DROPDOWN_CONTAINER, getDropdownItemClass, TRANSITION } from '../styles/interactive';
import { getAvailableThemes, type ThemeMeta } from './todo_graph/themes';
import { useGraphTheme } from './todo_graph/themes/context';

/** Button styling for the theme selector trigger */
const TRIGGER_BUTTON_CLASS = `flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm ${TRANSITION} hover:bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-700`;

/** Single theme option in the dropdown */
const ThemeOption: FC<{
  themeMeta: ThemeMeta;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onHover: () => void;
}> = ({ themeMeta, isSelected, isLoading, onSelect, onHover }) => (
  <button
    className={getDropdownItemClass(isSelected)}
    onClick={onSelect}
    onMouseEnter={onHover}
    type="button"
  >
    <div className="flex flex-col items-start">
      <span className="font-medium">
        {themeMeta.name}
        {isLoading && isSelected && (
          <span className="ml-2 text-xs text-neutral-400">loading...</span>
        )}
      </span>
      <span className="text-xs text-neutral-500 dark:text-neutral-400">
        {themeMeta.description}
      </span>
    </div>
  </button>
);

/** Theme selector dropdown component */
export const ThemeSelector: FC = () => {
  const { themeId, setThemeId, theme, isLoading, preloadTheme } = useGraphTheme();
  const availableThemes = getAvailableThemes();
  const [isOpen, setIsOpen] = useState(false);

  if (availableThemes.length <= 1) return null;

  // Get current theme name from metadata (always available)
  const currentThemeMeta = availableThemes.find((t) => t.id === themeId);
  const displayName = theme?.name ?? currentThemeMeta?.name ?? 'Theme';

  return (
    <div className="absolute top-4 right-4 z-10">
      <button className={TRIGGER_BUTTON_CLASS} onClick={() => setIsOpen(!isOpen)} type="button">
        <HiColorSwatch className="h-4 w-4" />
        <span>{displayName}</span>
        {isLoading && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-neutral-400 border-t-transparent" />
        )}
        {!isLoading && <HiChevronDown className="h-3 w-3" />}
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className={`right-0 w-64 p-2 ${DROPDOWN_CONTAINER}`}>
            <div className="mb-2 px-2">
              <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                Graph Theme
              </h3>
            </div>
            <div className="space-y-1">
              {availableThemes.map((t) => (
                <ThemeOption
                  isLoading={isLoading}
                  isSelected={themeId === t.id}
                  key={t.id}
                  onHover={() => preloadTheme(t.id)}
                  onSelect={() => {
                    setThemeId(t.id);
                    setIsOpen(false);
                  }}
                  themeMeta={t}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
