import type { FC } from 'react';

interface EmptyStateProps {
  /** Main heading text */
  title: string;
  /** Descriptive message below the title */
  description: string;
  /** Optional custom icon. Defaults to clipboard checkmark icon */
  icon?: React.ReactNode;
}

/** Displays a centered empty state with icon, title, and description */
export const EmptyState: FC<EmptyStateProps> = ({ title, description, icon }) => {
  const defaultIcon = (
    <svg
      aria-hidden="true"
      className="mx-auto h-12 w-12 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
      />
    </svg>
  );

  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-4 py-12">
      <div className="text-center">
        {icon ?? defaultIcon}
        <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">{title}</h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
    </div>
  );
};
