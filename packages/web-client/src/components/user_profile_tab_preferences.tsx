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
      <p className="text-xs text-neutral-500">{hint}</p>
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
    <p className="mt-1 text-xs text-neutral-500">{hint}</p>
  </div>
);

interface ScheduleSectionConfig {
  title: string;
  description: string;
  enableLabel: string;
  enableHint: string;
  timeId: string;
  timeLabel: string;
  timePlaceholder: string;
  timeHint: string;
}

interface ScheduleSectionState {
  enabled: boolean;
  time: string;
  printEnabled: boolean;
}

interface ScheduleSectionHandlers {
  onEnabledChange: (enabled: boolean) => void;
  onTimeChange: (time: string) => void;
  onPrintChange: (enabled: boolean) => void;
}

interface ScheduleSectionProps {
  config: ScheduleSectionConfig;
  state: ScheduleSectionState;
  handlers: ScheduleSectionHandlers;
  isLoading: boolean;
}

const ScheduleSection: FC<ScheduleSectionProps> = ({ config, state, handlers, isLoading }) => (
  <div className="rounded-lg border p-4">
    <div className="space-y-4">
      <div>
        <h3 className="font-medium text-neutral-900 dark:text-white">{config.title}</h3>
        <p className="text-sm text-neutral-600">{config.description}</p>
      </div>
      <ToggleRow
        checked={state.enabled}
        disabled={isLoading}
        hint={config.enableHint}
        label={config.enableLabel}
        onChange={handlers.onEnabledChange}
      />
      <ToggleRow
        checked={state.printEnabled}
        disabled={!state.enabled || isLoading}
        hint="Auto-print to thermal printer"
        label={`Print ${config.title}`}
        onChange={handlers.onPrintChange}
      />
      <TimeInput
        disabled={!state.enabled || isLoading}
        hint={config.timeHint}
        id={config.timeId}
        label={config.timeLabel}
        onChange={handlers.onTimeChange}
        placeholder={config.timePlaceholder}
        value={state.time}
      />
    </div>
  </div>
);

const briefingConfig: ScheduleSectionConfig = {
  title: 'Daily Briefings',
  description:
    'Receive daily briefings via Telegram bot at your preferred time with your todo summary, upcoming tasks, and time tracking.',
  enableLabel: 'Enable Daily Briefings',
  enableHint: 'Get personalized morning summaries',
  timeId: 'briefingTime',
  timeLabel: 'Briefing Time',
  timePlaceholder: '07:00',
  timeHint: 'Your preferred time for receiving daily briefings',
};

const recapConfig: ScheduleSectionConfig = {
  title: 'Daily Recaps',
  description:
    'Receive end-of-day recaps via Telegram bot with a motivational summary of your accomplishments and outlook for tomorrow.',
  enableLabel: 'Enable Daily Recaps',
  enableHint: 'Get personalized evening summaries',
  timeId: 'recapTime',
  timeLabel: 'Recap Time',
  timePlaceholder: '18:00',
  timeHint: 'Your preferred time for receiving daily recaps',
};

const buildBriefingSection = (props: PreferencesTabProps) => ({
  config: briefingConfig,
  handlers: {
    onEnabledChange: props.onDailyBriefingChange,
    onTimeChange: props.onBriefingTimeChange,
    onPrintChange: props.onPrintBriefingChange,
  },
  state: {
    enabled: props.preferencesState.dailyBriefing,
    time: props.preferencesState.briefingTime,
    printEnabled: props.preferencesState.printBriefing,
  },
});

const buildRecapSection = (props: PreferencesTabProps) => ({
  config: recapConfig,
  handlers: {
    onEnabledChange: props.onDailyRecapChange,
    onTimeChange: props.onRecapTimeChange,
    onPrintChange: props.onPrintRecapChange,
  },
  state: {
    enabled: props.preferencesState.dailyRecap,
    time: props.preferencesState.recapTime,
    printEnabled: props.preferencesState.printRecap,
  },
});

export const PreferencesTab: FC<PreferencesTabProps> = (props) => {
  const { isLoading, onSave } = props;
  const briefingSection = buildBriefingSection(props);
  const recapSection = buildRecapSection(props);

  return (
    <Card>
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">Preferences</h2>
        <div className="space-y-6">
          <ScheduleSection {...briefingSection} isLoading={isLoading} />
          <ScheduleSection {...recapSection} isLoading={isLoading} />
          <div className="flex justify-end">
            <Button color="blue" disabled={isLoading} onClick={onSave}>
              {isLoading ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
