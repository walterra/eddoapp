/**
 * Default theme node components.
 * Extracted from original todo_graph_*_node.tsx files.
 */
import { type FC } from 'react';
import { BiData, BiGitBranch } from 'react-icons/bi';
import { HiDesktopComputer, HiDocumentText, HiUser } from 'react-icons/hi';
import { RiRobot2Fill } from 'react-icons/ri';
import {
  VscFile,
  VscFileCode,
  VscFileMedia,
  VscFilePdf,
  VscFileZip,
  VscJson,
  VscMarkdown,
} from 'react-icons/vsc';

import type {
  NodeStyle,
  ThemedFileNodeProps,
  ThemedMetadataNodeProps,
  ThemedTodoNodeProps,
  ThemedUserNodeProps,
} from '../types';

// ============================================================================
// Todo Node
// ============================================================================

/** Build tooltip text with full details */
const buildTodoTooltip = (todo: ThemedTodoNodeProps['data']['todo']): string => {
  const parts = [todo.title];
  if (todo.context) parts.push(`Context: ${todo.context}`);
  if (todo.due) parts.push(`Due: ${new Date(todo.due).toLocaleDateString()}`);
  if (todo.tags.length > 0) parts.push(`Tags: ${todo.tags.join(', ')}`);
  if (todo.completed) parts.push('✓ Completed');
  return parts.join('\n');
};

/** Get node style based on todo state and highlight */
const getTodoNodeStyle = (isCompleted: boolean, isHighlighted: boolean): NodeStyle => {
  if (isHighlighted) {
    return {
      bgColor: 'bg-yellow-400',
      borderColor: 'border-yellow-300',
      extraClasses:
        'ring-4 ring-yellow-300 shadow-[0_0_30px_10px_rgba(250,204,21,0.7)] animate-pulse',
    };
  }
  if (isCompleted) {
    return { bgColor: 'bg-teal-700', borderColor: 'border-teal-600' };
  }
  return { bgColor: 'bg-slate-600', borderColor: 'border-slate-500' };
};

/** Truncate title for display */
const truncateTitle = (title: string, maxLen = 30): string =>
  title.length > maxLen ? `${title.slice(0, maxLen)}...` : title;

/** Default todo node component */
export const DefaultTodoNode: FC<ThemedTodoNodeProps> = ({ data, onClick }) => {
  const { todo, size, isHighlighted = false } = data;
  const { bgColor, borderColor, extraClasses } = getTodoNodeStyle(!!todo.completed, isHighlighted);
  const iconSize = Math.round(size * 0.6);
  const scale = isHighlighted ? 1.05 : 1;
  const iconColor = isHighlighted ? 'text-yellow-900' : 'text-white';

  return (
    <div className="group relative">
      <div
        className="absolute bottom-full left-1/2 z-10 mb-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div className="max-w-48 truncate rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 shadow">
          {truncateTitle(todo.title)}
        </div>
      </div>
      <div
        className={`flex cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-all duration-150 hover:scale-105 ${bgColor} ${borderColor} ${extraClasses ?? ''}`}
        onClick={onClick}
        style={{
          width: size,
          height: size,
          transform: `scale(${scale})`,
          zIndex: isHighlighted ? 1000 : 1,
        }}
        title={buildTodoTooltip(todo)}
      >
        <HiDocumentText className={iconColor} style={{ width: iconSize, height: iconSize }} />
      </div>
    </div>
  );
};

// ============================================================================
// File Node
// ============================================================================

/** File extension to icon mapping */
const FILE_ICONS: Record<string, typeof VscFile> = {
  ts: VscFileCode,
  tsx: VscFileCode,
  js: VscFileCode,
  jsx: VscFileCode,
  mjs: VscFileCode,
  cjs: VscFileCode,
  css: VscFileCode,
  scss: VscFileCode,
  sass: VscFileCode,
  less: VscFileCode,
  json: VscJson,
  jsonc: VscJson,
  md: VscMarkdown,
  mdx: VscMarkdown,
  txt: VscMarkdown,
  rst: VscMarkdown,
  sql: BiData,
  csv: BiData,
  xml: BiData,
  yaml: BiData,
  yml: BiData,
  toml: BiData,
  png: VscFileMedia,
  jpg: VscFileMedia,
  jpeg: VscFileMedia,
  gif: VscFileMedia,
  svg: VscFileMedia,
  webp: VscFileMedia,
  ico: VscFileMedia,
  zip: VscFileZip,
  tar: VscFileZip,
  gz: VscFileZip,
  rar: VscFileZip,
  '7z': VscFileZip,
  pdf: VscFilePdf,
};

/** Get file extension from path */
const getFileExtension = (filePath: string): string => {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/** Get icon based on file extension */
const getFileIcon = (filePath: string): typeof VscFile =>
  FILE_ICONS[getFileExtension(filePath)] ?? VscFile;

/** Default file node component */
export const DefaultFileNode: FC<ThemedFileNodeProps> = ({ data }) => {
  const { filePath, fileName, todoCount } = data;
  const tooltip = `${filePath}\nTouched by ${todoCount} todo${todoCount !== 1 ? 's' : ''}`;
  const Icon = getFileIcon(filePath);

  return (
    <div className="group relative">
      <div
        className="absolute bottom-full left-1/2 z-10 mb-1 opacity-0 transition-opacity group-hover:opacity-100"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div
          className="max-w-32 truncate rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 shadow"
          title={filePath}
        >
          {fileName}
        </div>
      </div>
      <div
        className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border-2 border-sky-500/70 bg-sky-600/70 shadow-md transition-transform hover:scale-105"
        title={tooltip}
      >
        <Icon className="h-4 w-4 text-white" />
      </div>
    </div>
  );
};

// ============================================================================
// Metadata Node
// ============================================================================

/** Get icon and color for metadata type */
const getMetadataStyle = (
  key: string,
): { Icon: typeof RiRobot2Fill; bgColor: string; borderColor: string } => {
  switch (key) {
    case 'agent:session':
    case 'agent:name':
      return { Icon: RiRobot2Fill, bgColor: 'bg-violet-600', borderColor: 'border-violet-500' };
    case 'agent:branch':
      return { Icon: BiGitBranch, bgColor: 'bg-amber-600', borderColor: 'border-amber-500' };
    case 'agent:cwd':
      return { Icon: HiDesktopComputer, bgColor: 'bg-sky-600', borderColor: 'border-sky-500' };
    default:
      return { Icon: RiRobot2Fill, bgColor: 'bg-violet-600', borderColor: 'border-violet-500' };
  }
};

/** Get short label for tooltip */
const getKeyLabel = (key: string): string => {
  const labels: Record<string, string> = {
    'agent:session': 'Session',
    'agent:model': 'Model',
    'agent:cwd': 'Directory',
    'agent:branch': 'Branch',
    'agent:name': 'Agent',
  };
  return labels[key] ?? key;
};

/** Default metadata node component */
export const DefaultMetadataNode: FC<ThemedMetadataNodeProps> = ({ data }) => {
  const { metadataKey, metadataValue, todoCount, lastMessage } = data;
  const label = getKeyLabel(metadataKey);
  const tooltip = `${label}: ${metadataValue}\n${todoCount} todos`;
  const { Icon, bgColor, borderColor } = getMetadataStyle(metadataKey);

  return (
    <div className="relative">
      {lastMessage && (
        <div
          className="absolute bottom-full left-1/2 z-[9999] mb-2"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="rounded-lg bg-violet-900 px-4 py-2 text-xs leading-relaxed text-violet-100 shadow-xl"
            style={{ minWidth: '200px', maxWidth: '350px' }}
          >
            {lastMessage}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-violet-900" />
        </div>
      )}
      <div
        className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-transform hover:scale-105 ${bgColor} ${borderColor}`}
        title={tooltip}
      >
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  );
};

// ============================================================================
// User Node
// ============================================================================

/** Default user node component */
export const DefaultUserNode: FC<ThemedUserNodeProps> = ({ data }) => {
  const { label, todoCount, lastMessage } = data;
  const tooltip = `${label}\n${todoCount} todo${todoCount !== 1 ? 's' : ''} modified`;

  return (
    <div className="group relative">
      {lastMessage ? (
        <div
          className="absolute bottom-full left-1/2 z-[9999] mb-2 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div
            className="rounded-lg bg-sky-900 px-4 py-2 text-xs leading-relaxed text-sky-100 shadow-xl"
            style={{ minWidth: '200px', maxWidth: '350px' }}
          >
            {lastMessage}
          </div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-sky-900" />
        </div>
      ) : (
        <div
          className="absolute bottom-full left-1/2 z-10 mb-1 opacity-0 transition-opacity group-hover:opacity-100"
          style={{ transform: 'translateX(-50%)' }}
        >
          <div className="rounded bg-sky-900 px-1.5 py-0.5 text-[10px] whitespace-nowrap text-sky-100 shadow">
            {label}
          </div>
        </div>
      )}
      <div
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-sky-400 bg-sky-500 shadow-md transition-transform hover:scale-105"
        title={tooltip}
      >
        <HiUser className="h-5 w-5 text-white" />
      </div>
    </div>
  );
};
