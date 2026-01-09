/**
 * Read-only metadata view component for todo display
 */
import { type FC } from 'react';

/** Label styling for field headers */
const LABEL_CLASS =
  'text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide';

interface MetadataViewProps {
  metadata: Record<string, string> | undefined;
}

export const MetadataView: FC<MetadataViewProps> = ({ metadata }) => {
  if (!metadata || Object.keys(metadata).length === 0) {
    return null;
  }

  const entries = Object.entries(metadata);

  return (
    <div>
      <div className={LABEL_CLASS}>Metadata ({entries.length})</div>
      <div className="mt-2 rounded-lg border border-neutral-200 bg-neutral-50 dark:border-neutral-600 dark:bg-neutral-900/50">
        <table className="w-full">
          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {entries.map(([key, value]) => (
              <tr key={key}>
                <td className="px-3 py-2 align-top font-mono text-xs font-medium whitespace-nowrap text-neutral-600 dark:text-neutral-400">
                  {key}
                </td>
                <td className="px-3 py-2 align-top font-mono text-xs break-all text-neutral-900 dark:text-white">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
