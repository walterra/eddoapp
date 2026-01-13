import { useCallback, type FC, type ReactNode } from 'react';
import { useDropzone, type Accept, type FileRejection } from 'react-dropzone';

import { MAX_ATTACHMENT_SIZE, validateAttachment } from '@eddo/core-shared';

/** File drop zone props */
export interface FileDropZoneProps {
  /** Called when valid files are dropped */
  onFilesDropped: (files: File[]) => void;
  /** Called when validation fails */
  onValidationError?: (errors: Array<{ file: File; error: string }>) => void;
  /** Whether uploads are in progress */
  isUploading?: boolean;
  /** Custom content to display inside drop zone */
  children?: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Whether to accept multiple files */
  multiple?: boolean;
  /** Whether the component is disabled */
  disabled?: boolean;
  /** Enable mobile camera capture (default: true on mobile) */
  enableCamera?: boolean;
}

/** Maps MIME types to react-dropzone Accept format */
const ACCEPT_CONFIG: Accept = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
};

/** Processes dropped files and separates valid from invalid */
function processDroppedFiles(
  acceptedFiles: File[],
  rejectedFiles: FileRejection[],
): { validFiles: File[]; errors: Array<{ file: File; error: string }> } {
  const validFiles: File[] = [];
  const errors: Array<{ file: File; error: string }> = [];

  for (const file of acceptedFiles) {
    const validation = validateAttachment(file.size, file.type);
    if (validation.valid) {
      validFiles.push(file);
    } else {
      errors.push({ file, error: validation.error ?? 'Validation failed' });
    }
  }

  for (const rejection of rejectedFiles) {
    const errorMessages = rejection.errors.map((e) => e.message).join(', ');
    errors.push({ file: rejection.file, error: errorMessages });
  }

  return { validFiles, errors };
}

/** Builds CSS classes for drop zone container */
function getContainerClasses(isDragActive: boolean, isInteractive: boolean): string {
  const base = `relative rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer
    focus:outline-none focus:ring-2 focus:ring-blue-500`;

  if (isDragActive) {
    return `${base} border-blue-500 bg-blue-50 dark:bg-blue-900/20`;
  }
  if (!isInteractive) {
    return `${base} border-neutral-300 bg-neutral-100 cursor-not-allowed dark:border-neutral-600 dark:bg-neutral-800`;
  }
  return `${base} border-neutral-300 hover:border-neutral-400 dark:border-neutral-600 dark:hover:border-neutral-500`;
}

/** Uses react-dropzone hook with standard config */
function useFileDropzone(
  onFilesDropped: (files: File[]) => void,
  onValidationError: ((errors: Array<{ file: File; error: string }>) => void) | undefined,
  multiple: boolean,
  isDisabled: boolean,
) {
  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      const { validFiles, errors } = processDroppedFiles(accepted, rejected);
      if (errors.length > 0) onValidationError?.(errors);
      if (validFiles.length > 0) onFilesDropped(validFiles);
    },
    [onFilesDropped, onValidationError],
  );

  return useDropzone({
    onDrop,
    accept: ACCEPT_CONFIG,
    maxSize: MAX_ATTACHMENT_SIZE,
    multiple,
    disabled: isDisabled,
  });
}

/**
 * Drag and drop zone for file uploads using react-dropzone.
 * Supports drag-drop and click-to-select.
 */
/** Detects if running on a mobile device */
function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export const FileDropZone: FC<FileDropZoneProps> = ({
  onFilesDropped,
  onValidationError,
  isUploading = false,
  children,
  className = '',
  multiple = true,
  disabled = false,
  enableCamera,
}) => {
  const isDisabled = disabled || isUploading;
  const { getRootProps, getInputProps, isDragActive } = useFileDropzone(
    onFilesDropped,
    onValidationError,
    multiple,
    isDisabled,
  );

  const rootProps = getRootProps();
  const inputProps = getInputProps();
  const showCamera = enableCamera ?? isMobileDevice();

  return (
    <div className={className}>
      <DropZoneContainer
        containerClasses={getContainerClasses(isDragActive, !isDisabled)}
        enableCamera={showCamera}
        inputProps={inputProps}
        isDisabled={isDisabled}
        isDragActive={isDragActive}
        isUploading={isUploading}
        rootProps={rootProps}
      >
        {children}
      </DropZoneContainer>
    </div>
  );
};

/** Container with event handlers */
const DropZoneContainer: FC<{
  containerClasses: string;
  rootProps: ReturnType<ReturnType<typeof useDropzone>['getRootProps']>;
  inputProps: ReturnType<ReturnType<typeof useDropzone>['getInputProps']>;
  isDisabled: boolean;
  isUploading: boolean;
  isDragActive: boolean;
  enableCamera: boolean;
  children?: ReactNode;
}> = ({
  containerClasses,
  rootProps,
  inputProps,
  isDisabled,
  isUploading,
  isDragActive,
  enableCamera,
  children,
}) => (
  <div
    className={containerClasses}
    onClick={rootProps.onClick}
    onDragEnter={rootProps.onDragEnter}
    onDragLeave={rootProps.onDragLeave}
    onDragOver={rootProps.onDragOver}
    onDrop={rootProps.onDrop}
    onKeyDown={rootProps.onKeyDown}
    ref={rootProps.ref}
    role="button"
    tabIndex={isDisabled ? -1 : 0}
  >
    {/* Standard file input */}
    <input {...inputProps} style={undefined} />
    {/* Mobile camera capture input - uses capture attribute */}
    {enableCamera && (
      <input
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={isDisabled}
        id="camera-capture-input"
        onChange={inputProps.onChange}
        type="file"
      />
    )}
    <DropZoneContent
      enableCamera={enableCamera}
      isDragActive={isDragActive}
      isUploading={isUploading}
    >
      {children}
    </DropZoneContent>
  </div>
);

/** Content renderer for drop zone */
const DropZoneContent: FC<{
  isUploading: boolean;
  isDragActive: boolean;
  enableCamera: boolean;
  children?: ReactNode;
}> = ({ isUploading, isDragActive, enableCamera, children }) => {
  if (isUploading) {
    return (
      <div className="flex flex-col items-center justify-center text-neutral-500">
        <UploadingSpinner />
        <span className="mt-2 text-sm">Uploading...</span>
      </div>
    );
  }
  if (children) return <>{children}</>;
  return <DefaultContent enableCamera={enableCamera} isDragActive={isDragActive} />;
};

/** Default content for drop zone */
const DefaultContent: FC<{ isDragActive: boolean; enableCamera: boolean }> = ({
  isDragActive,
  enableCamera,
}) => {
  const maxSizeMB = MAX_ATTACHMENT_SIZE / (1024 * 1024);
  return (
    <div className="flex flex-col items-center justify-center text-neutral-500 dark:text-neutral-400">
      <UploadIcon className="mb-2 h-8 w-8" />
      <p className="text-sm">
        {isDragActive ? (
          <span className="text-blue-600 dark:text-blue-400">Drop files here</span>
        ) : (
          <>
            <span className="text-blue-600 dark:text-blue-400">Click to upload</span>
            {enableCamera ? ' or take photo' : ' or drag and drop'}
          </>
        )}
      </p>
      <p className="mt-1 text-xs">Images & PDFs up to {maxSizeMB}MB (auto-compressed)</p>
    </div>
  );
};

/** Upload icon SVG */
const UploadIcon: FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    viewBox="0 0 24 24"
  >
    <path
      d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** Spinner for upload state */
const UploadingSpinner: FC = () => (
  <svg className="h-8 w-8 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      fill="currentColor"
    />
  </svg>
);
