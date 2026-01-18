/**
 * RPG2 theme node components.
 * Colorful isometric village buildings with cartoon style.
 */
import { type FC } from 'react';

import type {
  ThemedFileNodeProps,
  ThemedMetadataNodeProps,
  ThemedTodoNodeProps,
  ThemedUserNodeProps,
} from '../types';

/** Base path for RPG2 theme assets */
const ASSET_PATH = '/theme-assets/rpg2';

/** Build tooltip text with full details */
const buildTodoTooltip = (todo: ThemedTodoNodeProps['data']['todo']): string => {
  const parts = [todo.title];
  if (todo.context) parts.push(`Context: ${todo.context}`);
  if (todo.due) parts.push(`Due: ${new Date(todo.due).toLocaleDateString()}`);
  if (todo.tags.length > 0) parts.push(`Tags: ${todo.tags.join(', ')}`);
  if (todo.completed) parts.push('✓ Completed');
  return parts.join('\n');
};

/** Truncate title for display */
const truncateTitle = (title: string, maxLen = 25): string =>
  title.length > maxLen ? `${title.slice(0, maxLen)}...` : title;

/** RPG2 todo node - cottage for pending, larger building for complete */
export const Rpg2TodoNode: FC<ThemedTodoNodeProps> = ({ data, onClick }) => {
  const { todo, size, isHighlighted = false } = data;
  const iconSrc = todo.completed
    ? `${ASSET_PATH}/todo-completed.png`
    : `${ASSET_PATH}/todo-pending.png`;
  const scale = isHighlighted ? 1.15 : 1;
  const highlightFilter = isHighlighted
    ? 'drop-shadow(0 0 12px rgba(255,200,50,0.9)) drop-shadow(0 0 20px rgba(255,200,50,0.6))'
    : 'drop-shadow(2px 4px 4px rgba(0,0,0,0.3))';

  // Scale size to fit within grid tile (80px) with margin
  // Input size ranges 24-56px, target range ~40-70px to fit in one tile
  const displaySize = Math.min(size * 1.3, 70);

  return (
    <div
      className="group relative"
      style={{
        // Center the house on the grid point (similar to ground tiles)
        transform: `translate(-${displaySize / 2}px, -${displaySize * 0.7}px)`,
      }}
    >
      <div
        className="absolute bottom-full left-1/2 z-10 mb-2 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div className="max-w-52 truncate rounded-lg bg-amber-800/95 px-2 py-1 text-xs text-amber-100 shadow-lg">
          {truncateTitle(todo.title)}
        </div>
      </div>
      <div
        className="cursor-pointer transition-transform duration-150 hover:scale-105"
        onClick={onClick}
        style={{
          width: displaySize,
          height: displaySize,
          transform: `scale(${scale})`,
          zIndex: isHighlighted ? 1000 : 1,
        }}
        title={buildTodoTooltip(todo)}
      >
        <img
          alt={todo.completed ? 'Completed task' : 'Active task'}
          className="h-full w-full object-contain"
          src={iconSrc}
          style={{ filter: highlightFilter }}
        />
      </div>
    </div>
  );
};

/** Tree/bush variants for file nodes */
const TREE_VARIANTS = [
  `${ASSET_PATH}/tree-plain.png`,
  `${ASSET_PATH}/tree-plain2.png`,
  `${ASSET_PATH}/tree-orange.png`,
  `${ASSET_PATH}/tree-red.png`,
  `${ASSET_PATH}/tree-yellow.png`,
  `${ASSET_PATH}/bush.png`,
];

/** Deterministic hash for file path to select tree variant */
const hashFilePath = (filePath: string): number => {
  let hash = 0;
  for (let i = 0; i < filePath.length; i++) {
    const char = filePath.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

/** RPG2 file node - varied trees/bushes based on file path */
export const Rpg2FileNode: FC<ThemedFileNodeProps> = ({ data }) => {
  const { filePath, fileName, todoCount } = data;
  const tooltip = `${filePath}\nTouched by ${todoCount} task${todoCount !== 1 ? 's' : ''}`;

  // Deterministically select tree variant based on file path
  const variantIndex = hashFilePath(filePath) % TREE_VARIANTS.length;
  const treeSrc = TREE_VARIANTS[variantIndex];

  return (
    <div className="group relative">
      <div
        className="absolute bottom-full left-1/2 z-10 mb-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div className="max-w-32 truncate rounded bg-green-800/90 px-1.5 py-0.5 text-[10px] text-green-100 shadow">
          {fileName}
        </div>
      </div>
      <div
        className="h-12 w-12 cursor-pointer transition-transform hover:scale-110"
        title={tooltip}
      >
        <img
          alt="Resource"
          className="h-full w-full object-contain"
          src={treeSrc}
          style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.3))' }}
        />
      </div>
    </div>
  );
};

/** Get short label for tooltip */
const getKeyLabel = (key: string): string => {
  const labels: Record<string, string> = {
    'agent:session': 'Worker',
    'agent:model': 'Type',
    'agent:cwd': 'Location',
    'agent:branch': 'Path',
    'agent:name': 'Name',
  };
  return labels[key] ?? key;
};

/** RPG2 metadata node - signpost (speech bubble shown on walking character instead) */
export const Rpg2MetadataNode: FC<ThemedMetadataNodeProps> = ({ data }) => {
  const { metadataKey, metadataValue, todoCount } = data;
  const label = getKeyLabel(metadataKey);
  const tooltip = `${label}: ${metadataValue}\n${todoCount} tasks`;

  return (
    <div className="relative">
      <div
        className="h-10 w-10 cursor-pointer transition-transform hover:scale-110"
        title={tooltip}
      >
        <img
          alt="Signpost"
          className="h-full w-full object-contain"
          src={`${ASSET_PATH}/signpost.png`}
          style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.3))' }}
        />
      </div>
    </div>
  );
};

/** RPG2 user node - cart with horse */
export const Rpg2UserNode: FC<ThemedUserNodeProps> = ({ data }) => {
  const { label, todoCount, lastMessage } = data;
  const tooltip = `${label}\n${todoCount} task${todoCount !== 1 ? 's' : ''} assigned`;

  return (
    <div className="group relative">
      {lastMessage ? (
        <div
          className="absolute bottom-full left-1/2 z-[9999] mb-2 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="rounded-lg border-2 border-amber-600 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900 shadow-xl"
            style={{ minWidth: '180px', maxWidth: '320px' }}
          >
            {lastMessage}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-amber-50" />
        </div>
      ) : (
        <div
          className="absolute bottom-full left-1/2 z-10 mb-1 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div className="rounded bg-amber-800/90 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-amber-100 shadow">
            {label}
          </div>
        </div>
      )}
      <div
        className="h-14 w-20 cursor-pointer transition-transform hover:scale-105"
        title={tooltip}
      >
        <img
          alt="Villager"
          className="h-full w-full object-contain"
          src={`${ASSET_PATH}/cart.png`}
          style={{ filter: 'drop-shadow(2px 3px 3px rgba(0,0,0,0.3))' }}
        />
      </div>
    </div>
  );
};
