/**
 * Profile tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';

import { formatDate, type ProfileTabProps } from './user_profile_types';

export function ProfileTab({
  profile,
  isLoading,
  formState,
  editMode,
  onEditToggle,
  onEmailChange,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSave,
}: ProfileTabProps) {
  return (
    <Card>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Profile Information</h2>
          <Button color={editMode ? 'gray' : 'blue'} disabled={isLoading} onClick={onEditToggle}>
            {editMode ? 'Cancel' : 'Edit'}
          </Button>
        </div>

        <ProfileFormFields
          editMode={editMode}
          email={formState.email}
          isLoading={isLoading}
          onEmailChange={onEmailChange}
          profile={profile}
        />

        {editMode && (
          <PasswordChangeSection
            confirmPassword={formState.confirmPassword}
            currentPassword={formState.currentPassword}
            isLoading={isLoading}
            newPassword={formState.newPassword}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onCurrentPasswordChange={onCurrentPasswordChange}
            onNewPasswordChange={onNewPasswordChange}
          />
        )}

        {editMode && (
          <div className="flex justify-end space-x-4 border-t pt-6">
            <Button color="gray" disabled={isLoading} onClick={onEditToggle}>
              Cancel
            </Button>
            <Button color="blue" disabled={isLoading} onClick={onSave}>
              {isLoading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}

interface ProfileFormFieldsProps {
  profile: ProfileTabProps['profile'];
  email: string;
  editMode: boolean;
  isLoading: boolean;
  onEmailChange: (email: string) => void;
}

function ProfileFormFields({
  profile,
  email,
  editMode,
  isLoading,
  onEmailChange,
}: ProfileFormFieldsProps) {
  return (
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
        <p className="mt-1 text-xs text-gray-500">Username cannot be changed</p>
      </div>

      <div>
        <Label htmlFor="email">Email</Label>
        <TextInput
          disabled={!editMode || isLoading}
          id="email"
          onChange={(e) => onEmailChange(e.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <div>
        <Label htmlFor="status">Account Status</Label>
        <TextInput className="bg-gray-50" disabled id="status" type="text" value={profile.status} />
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
  );
}

interface PasswordChangeSectionProps {
  isLoading: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (password: string) => void;
  onNewPasswordChange: (password: string) => void;
  onConfirmPasswordChange: (password: string) => void;
}

function PasswordChangeSection({
  isLoading,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
}: PasswordChangeSectionProps) {
  return (
    <div className="space-y-4 border-t pt-6">
      <h3 className="text-lg font-medium text-gray-900">Change Password (Optional)</h3>

      <div>
        <Label htmlFor="currentPassword">Current Password</Label>
        <TextInput
          disabled={isLoading}
          id="currentPassword"
          onChange={(e) => onCurrentPasswordChange(e.target.value)}
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
            onChange={(e) => onNewPasswordChange(e.target.value)}
            placeholder="Enter new password"
            type="password"
            value={newPassword}
          />
          <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
        </div>

        <div>
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <TextInput
            disabled={isLoading}
            id="confirmPassword"
            onChange={(e) => onConfirmPasswordChange(e.target.value)}
            placeholder="Confirm new password"
            type="password"
            value={confirmPassword}
          />
        </div>
      </div>
    </div>
  );
}
