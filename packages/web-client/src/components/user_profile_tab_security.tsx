/**
 * Security tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';

import type { SecurityTabProps } from './user_profile_types';

export function SecurityTab({
  isLoading,
  formState,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onChangePassword,
}: SecurityTabProps) {
  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-6">
          <h2 className="text-xl font-semibold text-gray-900">Change Password</h2>

          <div className="space-y-4">
            <div>
              <Label htmlFor="secCurrentPassword">Current Password</Label>
              <TextInput
                disabled={isLoading}
                id="secCurrentPassword"
                onChange={(e) => onCurrentPasswordChange(e.target.value)}
                placeholder="Enter your current password"
                required
                type="password"
                value={formState.currentPassword}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="secNewPassword">New Password</Label>
                <TextInput
                  disabled={isLoading}
                  id="secNewPassword"
                  onChange={(e) => onNewPasswordChange(e.target.value)}
                  placeholder="Enter new password"
                  required
                  type="password"
                  value={formState.newPassword}
                />
                <p className="mt-1 text-xs text-gray-500">Minimum 8 characters</p>
              </div>

              <div>
                <Label htmlFor="secConfirmPassword">Confirm New Password</Label>
                <TextInput
                  disabled={isLoading}
                  id="secConfirmPassword"
                  onChange={(e) => onConfirmPasswordChange(e.target.value)}
                  placeholder="Confirm new password"
                  required
                  type="password"
                  value={formState.confirmPassword}
                />
              </div>
            </div>

            <Button color="blue" disabled={isLoading} onClick={onChangePassword}>
              {isLoading ? 'Changing Password...' : 'Change Password'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
