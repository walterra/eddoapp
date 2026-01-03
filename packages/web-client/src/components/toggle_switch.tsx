import { FOCUS_RING, TRANSITION } from '../styles/interactive';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  className = '',
}: ToggleSwitchProps) {
  const baseClass = `relative inline-flex h-6 w-11 items-center rounded-full ${TRANSITION} ${FOCUS_RING}`;
  const stateClass = checked
    ? 'bg-primary-600 hover:bg-primary-700'
    : 'bg-neutral-200 hover:bg-neutral-300 dark:bg-neutral-600 dark:hover:bg-neutral-500';
  const disabledClass = disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';

  return (
    <button
      aria-checked={checked}
      className={`${baseClass} ${stateClass} ${disabledClass} ${className}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 ${TRANSITION} ${checked ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}
