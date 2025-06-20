/**
 * Generates a stable, unique key from multiple parts
 * Used for React keys to ensure proper component reconciliation
 *
 * @param parts - Array of string, number, null, or undefined values
 * @returns A stable string key created by joining non-null parts with dashes
 *
 * @example
 * generateStableKey('todo', '2025-06-20', 'high') // 'todo-2025-06-20-high'
 * generateStableKey('session', null, 'active') // 'session-active'
 */
export function generateStableKey(
  ...parts: (string | number | null | undefined)[]
): string {
  return parts
    .filter((part) => part != null)
    .map((part) => String(part))
    .join('-');
}
