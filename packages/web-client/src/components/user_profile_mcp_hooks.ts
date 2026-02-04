/**
 * MCP API key handlers for UserProfile
 */
import { useCallback } from 'react';

import type { ProfileResult } from '../hooks/use_profile';

interface UseMcpApiKeyHandlerParams {
  setFormError: (error: string) => void;
  setSuccess: (success: string | null) => void;
  setGeneratedMcpApiKey: (key: string | null) => void;
  setGeneratedMcpApiKeySetAt: (value: string | null) => void;
  updatePreferences: (data: UpdatePreferencesData) => Promise<ProfileResult>;
}

interface UpdatePreferencesData {
  mcpApiKey?: string | null;
  mcpApiKeySetAt?: string;
}

function generateMcpApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

/** Create MCP API key handler */
export function useMcpApiKeyHandler({
  setFormError,
  setSuccess,
  setGeneratedMcpApiKey,
  setGeneratedMcpApiKeySetAt,
  updatePreferences,
}: UseMcpApiKeyHandlerParams) {
  return useCallback(async () => {
    setFormError('');
    setSuccess(null);
    const mcpApiKey = generateMcpApiKey();
    const mcpApiKeySetAt = new Date().toISOString();
    setGeneratedMcpApiKey(mcpApiKey);
    setGeneratedMcpApiKeySetAt(mcpApiKeySetAt);
    const result = await updatePreferences({ mcpApiKey, mcpApiKeySetAt });
    if (result.success) {
      setSuccess('MCP API key updated successfully. This key is shown only once.');
    } else {
      setFormError(result.error || 'Failed to update MCP API key');
    }
  }, [
    setFormError,
    setSuccess,
    setGeneratedMcpApiKey,
    setGeneratedMcpApiKeySetAt,
    updatePreferences,
  ]);
}
