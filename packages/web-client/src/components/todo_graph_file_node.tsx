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

/** Desaturated cold blue style for all file nodes */
const FILE_STYLE: FileStyle = {
  Icon: VscFile,
  bgColor: 'bg-sky-600/70',
  borderColor: 'border-sky-500/70',
};

/** File extension to icon mapping (all use same desaturated cold blue) */
const FILE_ICONS: Record<string, typeof VscFile> = {
  // Code files
  ts: VscFileCode,
  tsx: VscFileCode,
  js: VscFileCode,
  jsx: VscFileCode,
  mjs: VscFileCode,
  cjs: VscFileCode,
  // Style files
  css: VscFileCode,
  scss: VscFileCode,
  sass: VscFileCode,
  less: VscFileCode,
  // JSON/config
  json: VscJson,
  jsonc: VscJson,
  // Markdown/docs
  md: VscMarkdown,
  mdx: VscMarkdown,
  txt: VscMarkdown,
  rst: VscMarkdown,
  // Data files
  sql: BiData,
  csv: BiData,
  xml: BiData,
  yaml: BiData,
  yml: BiData,
  toml: BiData,
  // Media files
  png: VscFileMedia,
  jpg: VscFileMedia,
  jpeg: VscFileMedia,
  gif: VscFileMedia,
  svg: VscFileMedia,
  webp: VscFileMedia,
  ico: VscFileMedia,
  // Archive files
  zip: VscFileZip,
  tar: VscFileZip,
  gz: VscFileZip,
  rar: VscFileZip,
  '7z': VscFileZip,
  // PDF
  pdf: VscFilePdf,
};

/** Get file extension from path */
const getFileExtension = (filePath: string): string => {
  const parts = filePath.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
};

/** Get icon based on file extension (all use same desaturated cold blue color) */
const getFileStyle = (filePath: string): FileStyle => ({
  Icon: FILE_ICONS[getFileExtension(filePath)] ?? VscFile,
  bgColor: FILE_STYLE.bgColor,
  borderColor: FILE_STYLE.borderColor,
});

interface FileNodeProps {
  data: FileNodeData;
}

/** File node for React Flow */
export const FileNode: FC<FileNodeProps> = ({ data }) => {
  const { filePath, fileName, todoCount } = data;
  const tooltip = `${filePath}\nTouched by ${todoCount} todo${todoCount !== 1 ? 's' : ''}`;
  const { Icon, bgColor, borderColor } = getFileStyle(filePath);

  return (
    <div className="group relative">
      {/* File name label - only visible on hover */}
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

      {/* Node icon */}
      <div
        className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border-2 shadow-md transition-transform hover:scale-105 ${bgColor} ${borderColor}`}
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
