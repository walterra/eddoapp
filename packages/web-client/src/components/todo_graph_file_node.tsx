/**
 * File node component for the graph view.
 * Shows files that were touched by agents/todos with appropriate file type icons.
 */
import { Handle, Position } from '@xyflow/react';
import { type FC } from 'react';
import { BiData } from 'react-icons/bi';
import {
  VscFile,
  VscFileCode,
  VscFileMedia,
  VscFilePdf,
  VscFileZip,
  VscJson,
  VscMarkdown,
} from 'react-icons/vsc';

export interface FileNodeData {
  /** Full file path */
  filePath: string;
  /** Just the filename for display */
  fileName: string;
  /** Number of todos that touched this file */
  todoCount: number;
}

interface FileStyle {
  Icon: typeof VscFile;
  bgColor: string;
  borderColor: string;
}

/** Default style for unknown file types (desaturated) */
const DEFAULT_STYLE: FileStyle = {
  Icon: VscFile,
  bgColor: 'bg-slate-500',
  borderColor: 'border-slate-400',
};

/** File extension to style mapping (desaturated colors) */
const FILE_STYLES: Record<string, FileStyle> = {
  // Code files - muted yellow/amber
  ts: { Icon: VscFileCode, bgColor: 'bg-amber-500/70', borderColor: 'border-amber-400/70' },
  tsx: { Icon: VscFileCode, bgColor: 'bg-amber-500/70', borderColor: 'border-amber-400/70' },
  js: { Icon: VscFileCode, bgColor: 'bg-amber-500/70', borderColor: 'border-amber-400/70' },
  jsx: { Icon: VscFileCode, bgColor: 'bg-amber-500/70', borderColor: 'border-amber-400/70' },
  mjs: { Icon: VscFileCode, bgColor: 'bg-amber-500/70', borderColor: 'border-amber-400/70' },
  cjs: { Icon: VscFileCode, bgColor: 'bg-amber-500/70', borderColor: 'border-amber-400/70' },
  // Style files - muted pink
  css: { Icon: VscFileCode, bgColor: 'bg-pink-500/70', borderColor: 'border-pink-400/70' },
  scss: { Icon: VscFileCode, bgColor: 'bg-pink-500/70', borderColor: 'border-pink-400/70' },
  sass: { Icon: VscFileCode, bgColor: 'bg-pink-500/70', borderColor: 'border-pink-400/70' },
  less: { Icon: VscFileCode, bgColor: 'bg-pink-500/70', borderColor: 'border-pink-400/70' },
  // JSON/config - muted orange
  json: { Icon: VscJson, bgColor: 'bg-orange-500/70', borderColor: 'border-orange-400/70' },
  jsonc: { Icon: VscJson, bgColor: 'bg-orange-500/70', borderColor: 'border-orange-400/70' },
  // Markdown/docs - muted blue
  md: { Icon: VscMarkdown, bgColor: 'bg-blue-500/70', borderColor: 'border-blue-400/70' },
  mdx: { Icon: VscMarkdown, bgColor: 'bg-blue-500/70', borderColor: 'border-blue-400/70' },
  txt: { Icon: VscMarkdown, bgColor: 'bg-blue-500/70', borderColor: 'border-blue-400/70' },
  rst: { Icon: VscMarkdown, bgColor: 'bg-blue-500/70', borderColor: 'border-blue-400/70' },
  // Data files - muted teal
  sql: { Icon: BiData, bgColor: 'bg-teal-500/70', borderColor: 'border-teal-400/70' },
  csv: { Icon: BiData, bgColor: 'bg-teal-500/70', borderColor: 'border-teal-400/70' },
  xml: { Icon: BiData, bgColor: 'bg-teal-500/70', borderColor: 'border-teal-400/70' },
  yaml: { Icon: BiData, bgColor: 'bg-teal-500/70', borderColor: 'border-teal-400/70' },
  yml: { Icon: BiData, bgColor: 'bg-teal-500/70', borderColor: 'border-teal-400/70' },
  toml: { Icon: BiData, bgColor: 'bg-teal-500/70', borderColor: 'border-teal-400/70' },
  // Media files - muted indigo
  png: { Icon: VscFileMedia, bgColor: 'bg-indigo-500/70', borderColor: 'border-indigo-400/70' },
  jpg: { Icon: VscFileMedia, bgColor: 'bg-indigo-500/70', borderColor: 'border-indigo-400/70' },
  jpeg: { Icon: VscFileMedia, bgColor: 'bg-indigo-500/70', borderColor: 'border-indigo-400/70' },
  gif: { Icon: VscFileMedia, bgColor: 'bg-indigo-500/70', borderColor: 'border-indigo-400/70' },
  svg: { Icon: VscFileMedia, bgColor: 'bg-indigo-500/70', borderColor: 'border-indigo-400/70' },
  webp: { Icon: VscFileMedia, bgColor: 'bg-indigo-500/70', borderColor: 'border-indigo-400/70' },
  ico: { Icon: VscFileMedia, bgColor: 'bg-indigo-500/70', borderColor: 'border-indigo-400/70' },
  // Archive files - muted stone
  zip: { Icon: VscFileZip, bgColor: 'bg-stone-500/70', borderColor: 'border-stone-400/70' },
  tar: { Icon: VscFileZip, bgColor: 'bg-stone-500/70', borderColor: 'border-stone-400/70' },
  gz: { Icon: VscFileZip, bgColor: 'bg-stone-500/70', borderColor: 'border-stone-400/70' },
  rar: { Icon: VscFileZip, bgColor: 'bg-stone-500/70', borderColor: 'border-stone-400/70' },
  '7z': { Icon: VscFileZip, bgColor: 'bg-stone-500/70', borderColor: 'border-stone-400/70' },
  // PDF - muted red
  pdf: { Icon: VscFilePdf, bgColor: 'bg-red-500/70', borderColor: 'border-red-400/70' },
};

/** Get file extension from path */
const getFileExtension = (filePath: string): string => {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/** Get icon and color based on file extension */
const getFileStyle = (filePath: string): FileStyle =>
  FILE_STYLES[getFileExtension(filePath)] ?? DEFAULT_STYLE;

interface FileNodeProps {
  data: FileNodeData;
}

/** File node for React Flow */
export const FileNode: FC<FileNodeProps> = ({ data }) => {
  const { filePath, fileName, todoCount } = data;
  const tooltip = `${filePath}\nTouched by ${todoCount} todo${todoCount !== 1 ? 's' : ''}`;
  const { Icon, bgColor, borderColor } = getFileStyle(filePath);

  return (
    <div className="relative">
      {/* File name label */}
      <div
        className="absolute bottom-full left-1/2 z-10 mb-1"
        style={{ transform: 'translateX(-50%)' }}
      >
        <div
          className="max-w-32 truncate rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-200 shadow"
          title={filePath}
        >
          {fileName}
        </div>
      </div>

      {/* Node icon */}
      <div
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-transform hover:scale-125 ${bgColor} ${borderColor}`}
        title={tooltip}
      >
        <Icon className="h-4 w-4 text-white" />
        {/* Centered handles */}
        <Handle
          className="!top-1/2 !left-1/2 !h-1 !min-h-0 !w-1 !min-w-0 !-translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent"
          id="center"
          position={Position.Top}
          type="source"
        />
        <Handle
          className="!top-1/2 !left-1/2 !h-1 !min-h-0 !w-1 !min-w-0 !-translate-x-1/2 !-translate-y-1/2 !border-0 !bg-transparent"
          id="center"
          position={Position.Top}
          type="target"
        />
      </div>
    </div>
  );
};
