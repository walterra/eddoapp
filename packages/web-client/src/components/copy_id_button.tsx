/**
 * Copy-to-clipboard button for todo IDs
 */
import { type FC, useState } from 'react';
import { BiCheck, BiSolidCopyAlt } from 'react-icons/bi';

interface CopyIdButtonProps {
  todoId: string;
  /** Optional size variant */
  size?: 'sm' | 'md';
}

/**
 * Copies text to clipboard with fallback for Safari and older browsers.
 * Uses Clipboard API when available, falls back to execCommand.
 * @param text - Text to copy to clipboard
 * @returns Promise resolving to true on success, false on failure
 */
const copyToClipboard = async (text: string): Promise<boolean> => {
  // Try modern Clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to legacy method
    }
  }

  // Legacy fallback using execCommand (for Safari and older browsers)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.top = '-9999px';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
};

/**
 * Button that copies the todo ID to clipboard with visual feedback
 * @param todoId - The todo ID to copy
 * @param size - Size variant (sm for table cells, md for flyout)
 * @returns Copy button with success feedback
 */
export const CopyIdButton: FC<CopyIdButtonProps> = ({ todoId, size = 'sm' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    const success = await copyToClipboard(todoId);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const iconSize = size === 'sm' ? '1em' : '1.1em';

  return (
    <button
      className={
        copied
          ? 'text-green-500'
          : 'text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200'
      }
      onClick={handleCopyId}
      title={copied ? 'Copied!' : 'Copy ID'}
      type="button"
    >
      {copied ? <BiCheck size={iconSize} /> : <BiSolidCopyAlt size={iconSize} />}
    </button>
  );
};
