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
 * Button that copies the todo ID to clipboard with visual feedback
 * @param todoId - The todo ID to copy
 * @param size - Size variant (sm for table cells, md for flyout)
 * @returns Copy button with success feedback
 */
export const CopyIdButton: FC<CopyIdButtonProps> = ({ todoId, size = 'sm' }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyId = async () => {
    await navigator.clipboard.writeText(todoId);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
