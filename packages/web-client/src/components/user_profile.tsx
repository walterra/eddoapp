import { Button, Card, Label, TextInput } from 'flowbite-react';
import { useEffect, useState } from 'react';

import { useProfile } from '../hooks/use_profile';

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
    unlinkTelegram,
    clearError,
  } = useProfile();

  const [activeTab, setActiveTab] = useState<
    'profile' | 'security' | 'integrations'
  >('profile');
  const [editMode, setEditMode] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');

  // Initialize form when profile loads
  useEffect(() => {
    if (profile) {
      setEmail(profile.email);
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
            {(['profile', 'security', 'integrations'] as const).map((tab) => (
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
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <h3 className="font-medium text-gray-900">Telegram Bot</h3>
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
                  ) : (
                    <div className="text-sm text-gray-500">
                      Use the Telegram bot to link your account
                    </div>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
