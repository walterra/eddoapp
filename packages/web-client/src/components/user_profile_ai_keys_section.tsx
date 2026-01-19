/**
 * AI Provider API Keys section for UserProfile integrations tab
 */
import { Button, Label, TextInput, ToggleSwitch } from 'flowbite-react';
import { type FC, useState } from 'react';

import type { AiProviderKeys } from '@eddo/core-shared';

export interface AiKeysSectionProps {
  aiKeys: AiProviderKeys | undefined;
  isLoading: boolean;
  onSaveAiKeys: (keys: AiProviderKeys) => Promise<void>;
}

interface AiKeysFormState {
  anthropicApiKey: string;
  openaiApiKey: string;
  geminiApiKey: string;
}

interface KeyFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  disabled: boolean;
  showValue: boolean;
  onChange: (value: string) => void;
}

const KeyField: FC<KeyFieldProps> = (props) => (
  <div>
    <Label htmlFor={props.id}>{props.label}</Label>
    <TextInput
      disabled={props.disabled}
      id={props.id}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      type={props.showValue ? 'text' : 'password'}
      value={props.value}
    />
  </div>
);

const SectionHeader: FC = () => (
  <div className="flex items-center justify-between">
    <div>
      <h3 className="font-medium text-neutral-900 dark:text-white">AI Provider API Keys</h3>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Configure API keys for AI chat sessions (Claude, GPT, Gemini)
      </p>
    </div>
  </div>
);

const SecurityNote: FC = () => (
  <div className="text-sm text-neutral-500 dark:text-neutral-400">
    <p>
      🔒 <strong>Security Note:</strong> API keys are stored in your user preferences and used only
      for your chat sessions.
    </p>
  </div>
);

/** Check if form has unsaved changes */
function hasFormChanges(formState: AiKeysFormState, aiKeys?: AiProviderKeys): boolean {
  return (
    formState.anthropicApiKey !== (aiKeys?.anthropicApiKey || '') ||
    formState.openaiApiKey !== (aiKeys?.openaiApiKey || '') ||
    formState.geminiApiKey !== (aiKeys?.geminiApiKey || '')
  );
}

/** Build initial form state from AI keys */
function buildInitialState(aiKeys?: AiProviderKeys): AiKeysFormState {
  return {
    anthropicApiKey: aiKeys?.anthropicApiKey || '',
    openaiApiKey: aiKeys?.openaiApiKey || '',
    geminiApiKey: aiKeys?.geminiApiKey || '',
  };
}

/** Build API keys from form state */
function buildApiKeys(formState: AiKeysFormState): AiProviderKeys {
  return {
    anthropicApiKey: formState.anthropicApiKey || undefined,
    openaiApiKey: formState.openaiApiKey || undefined,
    geminiApiKey: formState.geminiApiKey || undefined,
  };
}

export const AiKeysSection: FC<AiKeysSectionProps> = ({ aiKeys, isLoading, onSaveAiKeys }) => {
  const [formState, setFormState] = useState<AiKeysFormState>(() => buildInitialState(aiKeys));
  const [showValues, setShowValues] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveAiKeys(buildApiKeys(formState));
    } finally {
      setIsSaving(false);
    }
  };

  const disabled = isLoading || isSaving;
  const hasChanges = hasFormChanges(formState, aiKeys);

  return (
    <div className="rounded-lg border p-4 dark:border-neutral-700">
      <SectionHeader />
      <AiKeysForm
        disabled={disabled}
        formState={formState}
        hasChanges={hasChanges}
        isSaving={isSaving}
        onSave={handleSave}
        setFormState={setFormState}
        setShowValues={setShowValues}
        showValues={showValues}
      />
    </div>
  );
};

interface AiKeysFormProps {
  formState: AiKeysFormState;
  setFormState: React.Dispatch<React.SetStateAction<AiKeysFormState>>;
  showValues: boolean;
  setShowValues: (v: boolean) => void;
  disabled: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  onSave: () => Promise<void>;
}

const AiKeysForm: FC<AiKeysFormProps> = (props) => (
  <div className="mt-4 space-y-4">
    <ToggleSwitch
      checked={props.showValues}
      label="Show API keys"
      onChange={() => props.setShowValues(!props.showValues)}
    />
    <KeyField
      disabled={props.disabled}
      id="anthropicApiKey"
      label="Anthropic API Key (Claude)"
      onChange={(v) => props.setFormState((s) => ({ ...s, anthropicApiKey: v }))}
      placeholder="sk-ant-api03-..."
      showValue={props.showValues}
      value={props.formState.anthropicApiKey}
    />
    <KeyField
      disabled={props.disabled}
      id="openaiApiKey"
      label="OpenAI API Key (GPT)"
      onChange={(v) => props.setFormState((s) => ({ ...s, openaiApiKey: v }))}
      placeholder="sk-..."
      showValue={props.showValues}
      value={props.formState.openaiApiKey}
    />
    <KeyField
      disabled={props.disabled}
      id="geminiApiKey"
      label="Google Gemini API Key"
      onChange={(v) => props.setFormState((s) => ({ ...s, geminiApiKey: v }))}
      placeholder="AIza..."
      showValue={props.showValues}
      value={props.formState.geminiApiKey}
    />
    <SecurityNote />
    <div className="flex justify-end">
      <Button color="blue" disabled={props.disabled || !props.hasChanges} onClick={props.onSave}>
        {props.isSaving ? 'Saving...' : 'Save API Keys'}
      </Button>
    </div>
  </div>
);
