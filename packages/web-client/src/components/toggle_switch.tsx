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
  return (
    <button
      aria-checked={checked}
      className={`focus:ring-primary-500 relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-offset-2 focus:outline-none ${
        checked ? 'bg-primary-600 hover:bg-primary-700' : 'bg-neutral-200 hover:bg-neutral-300'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} ${className} `}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      role="switch"
      type="button"
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-6' : 'translate-x-1'} `}
      />
    </button>
  );
}
