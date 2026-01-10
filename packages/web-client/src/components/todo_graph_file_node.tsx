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

/** Default style for unknown file types */
const DEFAULT_STYLE: FileStyle = {
  Icon: VscFile,
  bgColor: 'bg-slate-600',
  borderColor: 'border-slate-500',
};

/** File extension to style mapping */
const FILE_STYLES: Record<string, FileStyle> = {
  // Code files - yellow
  ts: { Icon: VscFileCode, bgColor: 'bg-yellow-600', borderColor: 'border-yellow-500' },
  tsx: { Icon: VscFileCode, bgColor: 'bg-yellow-600', borderColor: 'border-yellow-500' },
  js: { Icon: VscFileCode, bgColor: 'bg-yellow-600', borderColor: 'border-yellow-500' },
  jsx: { Icon: VscFileCode, bgColor: 'bg-yellow-600', borderColor: 'border-yellow-500' },
  mjs: { Icon: VscFileCode, bgColor: 'bg-yellow-600', borderColor: 'border-yellow-500' },
  cjs: { Icon: VscFileCode, bgColor: 'bg-yellow-600', borderColor: 'border-yellow-500' },
  // Style files - pink
  css: { Icon: VscFileCode, bgColor: 'bg-pink-600', borderColor: 'border-pink-500' },
  scss: { Icon: VscFileCode, bgColor: 'bg-pink-600', borderColor: 'border-pink-500' },
  sass: { Icon: VscFileCode, bgColor: 'bg-pink-600', borderColor: 'border-pink-500' },
  less: { Icon: VscFileCode, bgColor: 'bg-pink-600', borderColor: 'border-pink-500' },
  // JSON/config - amber
  json: { Icon: VscJson, bgColor: 'bg-amber-600', borderColor: 'border-amber-500' },
  jsonc: { Icon: VscJson, bgColor: 'bg-amber-600', borderColor: 'border-amber-500' },
  // Markdown/docs - blue
  md: { Icon: VscMarkdown, bgColor: 'bg-blue-600', borderColor: 'border-blue-500' },
  mdx: { Icon: VscMarkdown, bgColor: 'bg-blue-600', borderColor: 'border-blue-500' },
  txt: { Icon: VscMarkdown, bgColor: 'bg-blue-600', borderColor: 'border-blue-500' },
  rst: { Icon: VscMarkdown, bgColor: 'bg-blue-600', borderColor: 'border-blue-500' },
  // Data files - emerald
  sql: { Icon: BiData, bgColor: 'bg-emerald-600', borderColor: 'border-emerald-500' },
  csv: { Icon: BiData, bgColor: 'bg-emerald-600', borderColor: 'border-emerald-500' },
  xml: { Icon: BiData, bgColor: 'bg-emerald-600', borderColor: 'border-emerald-500' },
  yaml: { Icon: BiData, bgColor: 'bg-emerald-600', borderColor: 'border-emerald-500' },
  yml: { Icon: BiData, bgColor: 'bg-emerald-600', borderColor: 'border-emerald-500' },
  toml: { Icon: BiData, bgColor: 'bg-emerald-600', borderColor: 'border-emerald-500' },
  // Media files - purple
  png: { Icon: VscFileMedia, bgColor: 'bg-purple-600', borderColor: 'border-purple-500' },
  jpg: { Icon: VscFileMedia, bgColor: 'bg-purple-600', borderColor: 'border-purple-500' },
  jpeg: { Icon: VscFileMedia, bgColor: 'bg-purple-600', borderColor: 'border-purple-500' },
  gif: { Icon: VscFileMedia, bgColor: 'bg-purple-600', borderColor: 'border-purple-500' },
  svg: { Icon: VscFileMedia, bgColor: 'bg-purple-600', borderColor: 'border-purple-500' },
  webp: { Icon: VscFileMedia, bgColor: 'bg-purple-600', borderColor: 'border-purple-500' },
  ico: { Icon: VscFileMedia, bgColor: 'bg-purple-600', borderColor: 'border-purple-500' },
  // Archive files - orange
  zip: { Icon: VscFileZip, bgColor: 'bg-orange-600', borderColor: 'border-orange-500' },
  tar: { Icon: VscFileZip, bgColor: 'bg-orange-600', borderColor: 'border-orange-500' },
  gz: { Icon: VscFileZip, bgColor: 'bg-orange-600', borderColor: 'border-orange-500' },
  rar: { Icon: VscFileZip, bgColor: 'bg-orange-600', borderColor: 'border-orange-500' },
  '7z': { Icon: VscFileZip, bgColor: 'bg-orange-600', borderColor: 'border-orange-500' },
  // PDF - red
  pdf: { Icon: VscFilePdf, bgColor: 'bg-red-600', borderColor: 'border-red-500' },
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
