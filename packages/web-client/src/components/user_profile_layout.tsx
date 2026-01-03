/**
 * Layout components for UserProfile
 * Extracted from user_profile.tsx to reduce file size
 */
import { Button, Card } from 'flowbite-react';

type TabType = 'profile' | 'security' | 'integrations' | 'preferences';

export function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <div className="text-center">
        <div className="text-lg text-neutral-900 dark:text-white">Loading profile...</div>
      </div>
    </div>
  );
}

export function NotFoundState({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <Card className="w-full max-w-md">
        <div className="text-center">
          <h3 className="text-xl font-medium text-neutral-900 dark:text-white">
            Profile not found
          </h3>
          <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
            Unable to load your profile information.
          </p>
          {onClose && (
            <Button className="mt-4" onClick={onClose}>
              Go Back
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

export function PageHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Profile Settings</h1>
      {onClose && (
        <Button color="gray" onClick={onClose}>
          Back to App
        </Button>
      )}
    </div>
  );
}

export function TabNavigation({
  activeTab,
  onTabChange,
}: {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}) {
  const tabs: TabType[] = ['profile', 'security', 'integrations', 'preferences'];

  return (
    <div className="mb-6 border-b border-neutral-200 dark:border-neutral-700">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            className={`border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-neutral-500 hover:border-neutral-300 hover:text-neutral-700 dark:text-neutral-400 dark:hover:border-neutral-600 dark:hover:text-neutral-300'
            }`}
            key={tab}
            onClick={() => onTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>
    </div>
  );
}

export function MessageDisplay({
  success,
  error,
}: {
  success: string | null;
  error: string | null;
}) {
  if (!success && !error) return null;

  return (
    <div className="mb-6">
      {success && (
        <div className="bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-200 rounded-lg p-4 text-sm">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-error-100 text-error-700 dark:bg-error-900 dark:text-error-200 rounded-lg p-4 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
