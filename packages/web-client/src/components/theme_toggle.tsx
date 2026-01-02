import { type FC } from 'react';

import type { ThemePreference } from '../hooks/use_profile_types';
import { useTheme } from '../hooks/use_theme';
import { FOCUS_RING, TRANSITION } from '../styles/interactive';

interface ThemeOptionProps {
  value: ThemePreference;
  label: string;
  icon: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}

const ThemeOption: FC<ThemeOptionProps> = ({ value, label, icon, isSelected, onClick }) => (
  <button
    aria-label={`${label} theme`}
    aria-pressed={isSelected}
    className={`flex items-center justify-center rounded-md p-1.5 ${TRANSITION} ${FOCUS_RING} ${
      isSelected
        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
        : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-700'
    }`}
    data-testid={`theme-option-${value}`}
    onClick={onClick}
    title={label}
    type="button"
  >
    {icon}
  </button>
);

/** System theme icon (monitor) */
const SystemIcon: FC = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Light theme icon (sun) */
const LightIcon: FC = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Dark theme icon (moon) */
const DarkIcon: FC = () => (
  <svg
    aria-hidden="true"
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Theme toggle component with system/light/dark options
 */
export const ThemeToggle: FC = () => {
  const { theme, setTheme } = useTheme();

  const options: Array<{ value: ThemePreference; label: string; icon: React.ReactNode }> = [
    { value: 'system', label: 'System', icon: <SystemIcon /> },
    { value: 'light', label: 'Light', icon: <LightIcon /> },
    { value: 'dark', label: 'Dark', icon: <DarkIcon /> },
  ];

  return (
    <div
      aria-label="Theme selection"
      className="flex items-center gap-0.5 rounded-lg border border-neutral-300 bg-white p-0.5 dark:border-neutral-600 dark:bg-neutral-800"
      data-testid="theme-toggle"
      role="group"
    >
      {options.map((option) => (
        <ThemeOption
          icon={option.icon}
          isSelected={theme === option.value}
          key={option.value}
          label={option.label}
          onClick={() => setTheme(option.value)}
          value={option.value}
        />
      ))}
    </div>
  );
};
