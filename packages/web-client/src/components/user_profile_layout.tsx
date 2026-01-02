/**
 * Layout components for UserProfile
 * Extracted from user_profile.tsx to reduce file size
 */
import { Button, Card } from 'flowbite-react';

type TabType = 'profile' | 'security' | 'integrations' | 'preferences';

export function LoadingState() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="text-lg">Loading profile...</div>
      </div>
    </div>
  );
}

export function NotFoundState({ onClose }: { onClose?: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-md">
        <div className="text-center">
          <h3 className="text-xl font-medium text-gray-900">Profile not found</h3>
          <p className="mt-2 text-sm text-gray-600">Unable to load your profile information.</p>
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
      <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
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
    <div className="mb-6 border-b border-gray-200">
      <nav className="-mb-px flex space-x-8">
        {tabs.map((tab) => (
          <button
            className={`border-b-2 px-1 py-2 text-sm font-medium ${
              activeTab === tab
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
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
        <div className="rounded-lg bg-green-100 p-4 text-sm text-green-700">{success}</div>
      )}
      {error && <div className="rounded-lg bg-red-100 p-4 text-sm text-red-700">{error}</div>}
    </div>
  );
}
