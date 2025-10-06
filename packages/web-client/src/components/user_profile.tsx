import { Button, Card, Label, TextInput } from 'flowbite-react';
import { useEffect, useState } from 'react';

import { useProfile } from '../hooks/use_profile';
import { ToggleSwitch } from './toggle_switch';

interface UserProfileProps {
  onClose?: () => void;
}

export function UserProfile({ onClose }: UserProfileProps) {
  const {
    profile,
    isLoading,
    error,
    updateProfile,
    changePassword,
    linkTelegram,
    unlinkTelegram,
    updatePreferences,
    clearError,
  } = useProfile();

  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'integrations' | 'preferences'
  >('profile');
  const [editMode, setEditMode] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [telegramId, setTelegramId] = useState('');

  // Preferences states
  const [dailyBriefing, setDailyBriefing] = useState(false);
  const [briefingTime, setBriefingTime] = useState('07:00');
  const [printBriefing, setPrintBriefing] = useState(false);

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setEmail(profile.email);
      if (profile.preferences) {
        setDailyBriefing(profile.preferences.dailyBriefing);
        setBriefingTime(profile.preferences.briefingTime || '07:00');
        setPrintBriefing(profile.preferences.printBriefing || false);
      }
    }
  }, [profile]);

  const handleEditToggle = () => {
    if (editMode) {
      // Cancel edit - reset form
      setEmail(profile?.email || '');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFormError('');
    }
    setEditMode(!editMode);
    setSuccess(null);
    clearError();
  };

  const validateForm = (): string | null => {
    if (!email) {
      return 'Email is required';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return 'Please enter a valid email address';
    }

    if (newPassword) {
      if (!currentPassword) {
        return 'Current password is required to change password';
      }
      if (newPassword.length < 8) {
        return 'New password must be at least 8 characters long';
      }
      if (newPassword !== confirmPassword) {
        return 'New passwords do not match';
      }
    }

    return null;
  };

  const handleSaveProfile = async () => {
    setFormError('');
    setSuccess(null);

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const updateData: Record<string, unknown> = {};

    // Check if email changed
    if (email !== profile?.email) {
      updateData.email = email;
    }

    // Check if password should be changed
    if (newPassword) {
      updateData.currentPassword = currentPassword;
      updateData.newPassword = newPassword;
    }

    // Only update if there are changes
    if (Object.keys(updateData).length === 0) {
      setEditMode(false);
      return;
    }

    const result = await updateProfile(updateData);
    if (result.success) {
      setSuccess('Profile updated successfully');
      setEditMode(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setFormError(result.error || 'Failed to update profile');
    }
  };

  const handleChangePassword = async () => {
    setFormError('');
    setSuccess(null);

    if (!currentPassword || !newPassword) {
      setFormError('Both current and new passwords are required');
      return;
    }

    if (newPassword.length < 8) {
      setFormError('New password must be at least 8 characters long');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('New passwords do not match');
      return;
    }

    const result = await changePassword({
      currentPassword,
      newPassword,
    });

    if (result.success) {
      setSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setFormError(result.error || 'Failed to change password');
    }
  };

  const handleLinkTelegram = async () => {
    setFormError('');
    setSuccess(null);

    if (!telegramId) {
      setFormError('Please enter your Telegram ID');
      return;
    }

    const telegramIdNumber = parseInt(telegramId, 10);
    if (isNaN(telegramIdNumber) || telegramIdNumber <= 0) {
      setFormError('Please enter a valid Telegram ID (positive number)');
      return;
    }

    const result = await linkTelegram(telegramIdNumber);
    if (result.success) {
      setSuccess('Telegram account linked successfully');
      setTelegramId('');
    } else {
      setFormError(result.error || 'Failed to link Telegram');
    }
  };

  const handleUnlinkTelegram = async () => {
    if (!confirm('Are you sure you want to unlink your Telegram account?')) {
      return;
    }

    const result = await unlinkTelegram();
    if (result.success) {
      setSuccess('Telegram account unlinked successfully');
    } else {
      setFormError(result.error || 'Failed to unlink Telegram');
    }
  };

  const handleUpdatePreferences = async () => {
    setFormError('');
    setSuccess(null);

    const result = await updatePreferences({
      dailyBriefing,
      briefingTime,
      printBriefing,
    });

    if (result.success) {
      setSuccess('Preferences updated successfully');
    } else {
      setFormError(result.error || 'Failed to update preferences');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading && !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-lg">Loading profile...</div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card className="w-full max-w-md">
          <div className="text-center">
            <h3 className="text-xl font-medium text-gray-900">
              Profile not found
            </h3>
            <p className="mt-2 text-sm text-gray-600">
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

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
          {onClose && (
            <Button color="gray" onClick={onClose}>
              Back to App
            </Button>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {(
              ['profile', 'security', 'integrations', 'preferences'] as const
            ).map((tab) => (
              <button
                className={`border-b-2 px-1 py-2 text-sm font-medium ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                }`}
                key={tab}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        {/* Success/Error Messages */}
        {(success || error || formError) && (
          <div className="mb-6">
            {success && (
              <div className="rounded-lg bg-green-100 p-4 text-sm text-green-700">
                {success}
              </div>
            )}
            {(error || formError) && (
              <div className="rounded-lg bg-red-100 p-4 text-sm text-red-700">
                {error || formError}
              </div>
            )}
          </div>
        )}

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card>
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  Profile Information
                </h2>
                <Button
                  color={editMode ? 'gray' : 'blue'}
                  disabled={isLoading}
                  onClick={handleEditToggle}
                >
                  {editMode ? 'Cancel' : 'Edit'}
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <TextInput
                    className="bg-gray-50"
                    disabled
                    id="username"
                    type="text"
                    value={profile.username}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Username cannot be changed
                  </p>
                </div>

                <div>
                  <Label htmlFor="email">Email</Label>
                  <TextInput
                    disabled={!editMode || isLoading}
                    id="email"
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    type="email"
                    value={email}
                  />
                </div>

                <div>
                  <Label htmlFor="status">Account Status</Label>
                  <TextInput
                    className="bg-gray-50"
                    disabled
                    id="status"
                    type="text"
                    value={profile.status}
                  />
                </div>

                <div>
                  <Label htmlFor="permissions">Permissions</Label>
                  <TextInput
                    className="bg-gray-50"
                    disabled
                    id="permissions"
                    type="text"
                    value={profile.permissions.join(', ')}
                  />
                </div>

                <div>
                  <Label htmlFor="created">Account Created</Label>
                  <TextInput
                    className="bg-gray-50"
                    disabled
                    id="created"
                    type="text"
                    value={formatDate(profile.createdAt)}
                  />
                </div>

                <div>
                  <Label htmlFor="updated">Last Updated</Label>
                  <TextInput
                    className="bg-gray-50"
                    disabled
                    id="updated"
                    type="text"
                    value={formatDate(profile.updatedAt)}
                  />
                </div>
              </div>

              {editMode && (
                <div className="space-y-4 border-t pt-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    Change Password (Optional)
                  </h3>

                  <div>
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <TextInput
                      disabled={isLoading}
                      id="currentPassword"
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      type="password"
                      value={currentPassword}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="newPassword">New Password</Label>
                      <TextInput
                        disabled={isLoading}
                        id="newPassword"
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        type="password"
                        value={newPassword}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum 8 characters
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="confirmPassword">
                        Confirm New Password
                      </Label>
                      <TextInput
                        disabled={isLoading}
                        id="confirmPassword"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        type="password"
                        value={confirmPassword}
                      />
                    </div>
                  </div>
                </div>
              )}

              {editMode && (
                <div className="flex justify-end space-x-4 border-t pt-6">
                  <Button
                    color="gray"
                    disabled={isLoading}
                    onClick={handleEditToggle}
                  >
                    Cancel
                  </Button>
                  <Button
                    color="blue"
                    disabled={isLoading}
                    onClick={handleSaveProfile}
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-6">
            <Card>
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-gray-900">
                  Change Password
                </h2>

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="secCurrentPassword">Current Password</Label>
                    <TextInput
                      disabled={isLoading}
                      id="secCurrentPassword"
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      required
                      type="password"
                      value={currentPassword}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="secNewPassword">New Password</Label>
                      <TextInput
                        disabled={isLoading}
                        id="secNewPassword"
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        required
                        type="password"
                        value={newPassword}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Minimum 8 characters
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="secConfirmPassword">
                        Confirm New Password
                      </Label>
                      <TextInput
                        disabled={isLoading}
                        id="secConfirmPassword"
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        required
                        type="password"
                        value={confirmPassword}
                      />
                    </div>
                  </div>

                  <Button
                    color="blue"
                    disabled={isLoading}
                    onClick={handleChangePassword}
                  >
                    {isLoading ? 'Changing Password...' : 'Change Password'}
                  </Button>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <Card>
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                External Integrations
              </h2>

              <div className="space-y-4">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Telegram Bot
                      </h3>
                      <p className="text-sm text-gray-600">
                        {profile.telegramId
                          ? `Connected to Telegram ID: ${profile.telegramId}`
                          : 'Not connected to Telegram'}
                      </p>
                    </div>

                    {profile.telegramId ? (
                      <Button
                        color="red"
                        disabled={isLoading}
                        onClick={handleUnlinkTelegram}
                      >
                        {isLoading ? 'Unlinking...' : 'Unlink'}
                      </Button>
                    ) : null}
                  </div>

                  {!profile.telegramId && (
                    <div className="mt-4 space-y-4 border-t pt-4">
                      <div>
                        <h4 className="font-medium text-gray-900">
                          Link Telegram Account
                        </h4>
                        <p className="text-sm text-gray-600">
                          Enter your Telegram ID to link your account. You can
                          get your Telegram ID by messaging the bot.
                        </p>
                      </div>

                      <div className="flex items-end gap-3">
                        <div className="flex-1">
                          <Label htmlFor="telegramId">Telegram ID</Label>
                          <TextInput
                            disabled={isLoading}
                            id="telegramId"
                            onChange={(e) => setTelegramId(e.target.value)}
                            placeholder="Enter your Telegram ID (e.g., 123456789)"
                            type="text"
                            value={telegramId}
                          />
                        </div>
                        <Button
                          color="blue"
                          disabled={isLoading || !telegramId}
                          onClick={handleLinkTelegram}
                        >
                          {isLoading ? 'Linking...' : 'Link Account'}
                        </Button>
                      </div>

                      <div className="text-sm text-gray-500">
                        <p>
                          💡 <strong>How to get your Telegram ID:</strong>
                        </p>
                        <ol className="mt-1 list-inside list-decimal space-y-1">
                          <li>Message the Telegram bot</li>
                          <li>The bot will reply with your Telegram ID</li>
                          <li>Copy and paste it into the field above</li>
                          <li>Click &quot;Link Account&quot;</li>
                        </ol>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <Card>
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Preferences
              </h2>

              <div className="space-y-6">
                <div className="rounded-lg border p-4">
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium text-gray-900">
                        Daily Briefings
                      </h3>
                      <p className="text-sm text-gray-600">
                        Receive daily briefings via Telegram bot at your
                        preferred time with your todo summary, upcoming tasks,
                        and time tracking.
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Daily Briefings</Label>
                        <p className="text-xs text-gray-500">
                          Get personalized morning summaries
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={dailyBriefing}
                        disabled={isLoading}
                        onChange={setDailyBriefing}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Print Briefings</Label>
                        <p className="text-xs text-gray-500">
                          Auto-print briefings to thermal printer
                        </p>
                      </div>
                      <ToggleSwitch
                        checked={printBriefing}
                        disabled={!dailyBriefing || isLoading}
                        onChange={setPrintBriefing}
                      />
                    </div>

                    <div>
                      <Label htmlFor="briefingTime">Briefing Time</Label>
                      <TextInput
                        disabled={!dailyBriefing || isLoading}
                        id="briefingTime"
                        onChange={(e) => setBriefingTime(e.target.value)}
                        pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
                        placeholder="07:00"
                        type="time"
                        value={briefingTime}
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Your preferred time for receiving daily briefings
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    color="blue"
                    disabled={isLoading}
                    onClick={handleUpdatePreferences}
                  >
                    {isLoading ? 'Saving...' : 'Save Preferences'}
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
