/**
 * Preferences tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';

import { ToggleSwitch } from './toggle_switch';
import type { PreferencesTabProps } from './user_profile_types';

export function PreferencesTab({
  isLoading,
  preferencesState,
  onDailyBriefingChange,
  onBriefingTimeChange,
  onPrintBriefingChange,
  onDailyRecapChange,
  onRecapTimeChange,
  onPrintRecapChange,
  onSave,
}: PreferencesTabProps) {
  return (
    <Card>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-gray-900">Preferences</h2>

        <div className="space-y-6">
          <BriefingSection
            briefingTime={preferencesState.briefingTime}
            dailyBriefing={preferencesState.dailyBriefing}
            isLoading={isLoading}
            onBriefingTimeChange={onBriefingTimeChange}
            onDailyBriefingChange={onDailyBriefingChange}
            onPrintBriefingChange={onPrintBriefingChange}
            printBriefing={preferencesState.printBriefing}
          />

          <RecapSection
            dailyRecap={preferencesState.dailyRecap}
            isLoading={isLoading}
            onDailyRecapChange={onDailyRecapChange}
            onPrintRecapChange={onPrintRecapChange}
            onRecapTimeChange={onRecapTimeChange}
            printRecap={preferencesState.printRecap}
            recapTime={preferencesState.recapTime}
          />

          <div className="flex justify-end">
            <Button color="blue" disabled={isLoading} onClick={onSave}>
              {isLoading ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

interface BriefingSectionProps {
  dailyBriefing: boolean;
  briefingTime: string;
  printBriefing: boolean;
  isLoading: boolean;
  onDailyBriefingChange: (enabled: boolean) => void;
  onBriefingTimeChange: (time: string) => void;
  onPrintBriefingChange: (enabled: boolean) => void;
}

function BriefingSection({
  dailyBriefing,
  briefingTime,
  printBriefing,
  isLoading,
  onDailyBriefingChange,
  onBriefingTimeChange,
  onPrintBriefingChange,
}: BriefingSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-gray-900">Daily Briefings</h3>
          <p className="text-sm text-gray-600">
            Receive daily briefings via Telegram bot at your preferred time with your todo summary,
            upcoming tasks, and time tracking.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Daily Briefings</Label>
            <p className="text-xs text-gray-500">Get personalized morning summaries</p>
          </div>
          <ToggleSwitch
            checked={dailyBriefing}
            disabled={isLoading}
            onChange={onDailyBriefingChange}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Print Briefings</Label>
            <p className="text-xs text-gray-500">Auto-print briefings to thermal printer</p>
          </div>
          <ToggleSwitch
            checked={printBriefing}
            disabled={!dailyBriefing || isLoading}
            onChange={onPrintBriefingChange}
          />
        </div>

        <div>
          <Label htmlFor="briefingTime">Briefing Time</Label>
          <TextInput
            disabled={!dailyBriefing || isLoading}
            id="briefingTime"
            onChange={(e) => onBriefingTimeChange(e.target.value)}
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
  );
}

interface RecapSectionProps {
  dailyRecap: boolean;
  recapTime: string;
  printRecap: boolean;
  isLoading: boolean;
  onDailyRecapChange: (enabled: boolean) => void;
  onRecapTimeChange: (time: string) => void;
  onPrintRecapChange: (enabled: boolean) => void;
}

function RecapSection({
  dailyRecap,
  recapTime,
  printRecap,
  isLoading,
  onDailyRecapChange,
  onRecapTimeChange,
  onPrintRecapChange,
}: RecapSectionProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="space-y-4">
        <div>
          <h3 className="font-medium text-gray-900">Daily Recaps</h3>
          <p className="text-sm text-gray-600">
            Receive end-of-day recaps via Telegram bot with a motivational summary of your
            accomplishments and outlook for tomorrow.
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Enable Daily Recaps</Label>
            <p className="text-xs text-gray-500">Get personalized evening summaries</p>
          </div>
          <ToggleSwitch checked={dailyRecap} disabled={isLoading} onChange={onDailyRecapChange} />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label>Print Recaps</Label>
            <p className="text-xs text-gray-500">Auto-print recaps to thermal printer</p>
          </div>
          <ToggleSwitch
            checked={printRecap}
            disabled={!dailyRecap || isLoading}
            onChange={onPrintRecapChange}
          />
        </div>

        <div>
          <Label htmlFor="recapTime">Recap Time</Label>
          <TextInput
            disabled={!dailyRecap || isLoading}
            id="recapTime"
            onChange={(e) => onRecapTimeChange(e.target.value)}
            pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
            placeholder="18:00"
            type="time"
            value={recapTime}
          />
          <p className="mt-1 text-xs text-gray-500">
            Your preferred time for receiving daily recaps
          </p>
        </div>
      </div>
    </div>
  );
}
