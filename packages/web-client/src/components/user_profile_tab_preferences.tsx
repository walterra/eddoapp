/**
 * Preferences tab component for UserProfile
 */
import { Button, Card, Label, TextInput } from 'flowbite-react';
import { type FC } from 'react';

import { ToggleSwitch } from './toggle_switch';
import type { PreferencesTabProps } from './user_profile_types';

interface ToggleRowProps {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (enabled: boolean) => void;
}

const ToggleRow: FC<ToggleRowProps> = ({ label, hint, checked, disabled, onChange }) => (
  <div className="flex items-center justify-between">
    <div>
      <Label>{label}</Label>
      <p className="text-xs text-gray-500">{hint}</p>
    </div>
    <ToggleSwitch checked={checked} disabled={disabled} onChange={onChange} />
  </div>
);

interface TimeInputProps {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
  placeholder: string;
  hint: string;
  onChange: (value: string) => void;
}

const TimeInput: FC<TimeInputProps> = ({
  id,
  label,
  value,
  disabled,
  placeholder,
  hint,
  onChange,
}) => (
  <div>
    <Label htmlFor={id}>{label}</Label>
    <TextInput
      disabled={disabled}
      id={id}
      onChange={(e) => onChange(e.target.value)}
      pattern="^([01]?[0-9]|2[0-3]):[0-5][0-9]$"
      placeholder={placeholder}
      type="time"
      value={value}
    />
    <p className="mt-1 text-xs text-gray-500">{hint}</p>
  </div>
);

interface ScheduleSectionProps {
  title: string;
  description: string;
  enabled: boolean;
  time: string;
  printEnabled: boolean;
  isLoading: boolean;
  enableLabel: string;
  enableHint: string;
  timeId: string;
  timeLabel: string;
  timePlaceholder: string;
  timeHint: string;
  onEnabledChange: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
  onPrintChange: (enabled: boolean) => void;
}

const ScheduleSection: FC<ScheduleSectionProps> = ({
  title,
  description,
  enabled,
  time,
  printEnabled,
  isLoading,
  enableLabel,
  enableHint,
  timeId,
  timeLabel,
  timePlaceholder,
  timeHint,
  onEnabledChange,
  onTimeChange,
  onPrintChange,
}) => (
  <div className="rounded-lg border p-4">
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-gray-900">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
      </div>
      <ToggleRow
        checked={enabled}
        disabled={isLoading}
        hint={enableHint}
        label={enableLabel}
        onChange={onEnabledChange}
      />
      <ToggleRow
        checked={printEnabled}
        disabled={!enabled || isLoading}
        hint="Auto-print to thermal printer"
        label={`Print ${title}`}
        onChange={onPrintChange}
      />
      <TimeInput
        disabled={!enabled || isLoading}
        hint={timeHint}
        id={timeId}
        label={timeLabel}
        onChange={onTimeChange}
        placeholder={timePlaceholder}
        value={time}
      />
    </div>
  </div>
);

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
          <ScheduleSection
            description="Receive daily briefings via Telegram bot at your preferred time with your todo summary, upcoming tasks, and time tracking."
            enableHint="Get personalized morning summaries"
            enableLabel="Enable Daily Briefings"
            enabled={preferencesState.dailyBriefing}
            isLoading={isLoading}
            onEnabledChange={onDailyBriefingChange}
            onPrintChange={onPrintBriefingChange}
            onTimeChange={onBriefingTimeChange}
            printEnabled={preferencesState.printBriefing}
            time={preferencesState.briefingTime}
            timeHint="Your preferred time for receiving daily briefings"
            timeId="briefingTime"
            timeLabel="Briefing Time"
            timePlaceholder="07:00"
            title="Daily Briefings"
          />
          <ScheduleSection
            description="Receive end-of-day recaps via Telegram bot with a motivational summary of your accomplishments and outlook for tomorrow."
            enableHint="Get personalized evening summaries"
            enableLabel="Enable Daily Recaps"
            enabled={preferencesState.dailyRecap}
            isLoading={isLoading}
            onEnabledChange={onDailyRecapChange}
            onPrintChange={onPrintRecapChange}
            onTimeChange={onRecapTimeChange}
            printEnabled={preferencesState.printRecap}
            time={preferencesState.recapTime}
            timeHint="Your preferred time for receiving daily recaps"
            timeId="recapTime"
            timeLabel="Recap Time"
            timePlaceholder="18:00"
            title="Daily Recaps"
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
