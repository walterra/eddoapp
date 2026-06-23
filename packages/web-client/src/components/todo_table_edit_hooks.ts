import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type MouseEvent,
} from 'react';

interface EditableFieldParams {
  initialValue: string;
  onSave: (value: string) => Promise<boolean>;
}

export interface EditableFieldState {
  draft: string;
  handleBlur: () => void;
  handleChange: (event: ChangeEvent<HTMLInputElement>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => Promise<void>;
  isEditing: boolean;
  startEdit: () => void;
}

export const useEditableField = ({
  initialValue,
  onSave,
}: EditableFieldParams): EditableFieldState => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);

  const resetState = useCallback(() => {
    setDraft(initialValue);
    setIsEditing(false);
  }, [initialValue]);

  const startEdit = useCallback(() => {
    setDraft(initialValue);
    setIsEditing(true);
  }, [initialValue]);

  const handleSave = useCallback(async () => {
    const didSave = await onSave(draft);
    if (didSave) {
      setIsEditing(false);
      return;
    }
    resetState();
  }, [draft, onSave, resetState]);

  const handleKeyDown = useCallback(
    async (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        await handleSave();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        resetState();
      }
    },
    [handleSave, resetState],
  );

  const handleBlur = useCallback(() => {
    void handleSave();
  }, [handleSave]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.target.value);
  }, []);

  return { draft, handleBlur, handleChange, handleKeyDown, isEditing, startEdit };
};

interface ClickHandlers {
  handleClick: () => void;
  handleDoubleClick: (event: MouseEvent) => void;
}

interface ClickHandlerParams {
  delay?: number;
  onDoubleClick: () => void;
  onSingleClick: () => void;
}

export const useSingleDoubleClick = ({
  delay = 200,
  onDoubleClick,
  onSingleClick,
}: ClickHandlerParams): ClickHandlers => {
  const timeoutRef = useRef<number | null>(null);

  const handleClick = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(onSingleClick, delay);
  }, [delay, onSingleClick]);

  const handleDoubleClick = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
      onDoubleClick();
    },
    [onDoubleClick],
  );

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  return { handleClick, handleDoubleClick };
};
