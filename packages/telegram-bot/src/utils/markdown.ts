import { marked } from 'marked';

/**
 * Markdown validation utility for Telegram message formatting using marked
 */

interface MarkdownValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates if a string is valid markdown using marked parser
 * If marked can parse it without errors, it's considered valid
 */
export function validateTelegramMarkdown(
  text: string,
): MarkdownValidationResult {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Empty or invalid text' };
  }

  try {
    // Try to parse with marked - if it throws, markdown is invalid
    marked(text);
    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Markdown parsing error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Checks if text contains any markdown formatting by comparing parsed output with original
 */
export function hasMarkdownFormatting(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  try {
    // Parse the markdown and check if it produces different output than plain text
    const parsed = marked(text);
    // If the parsed HTML is different from wrapped plain text, it has markdown formatting
    const plainTextWrapped = `<p>${text}</p>\n`;
    return parsed !== plainTextWrapped;
  } catch (_error) {
    // If parsing fails, assume no markdown formatting
    return false;
  }
}
