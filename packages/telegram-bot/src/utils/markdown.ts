/**
 * Simple markdown validation utility for Telegram message formatting
 */

interface MarkdownValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates if a string is valid Telegram markdown
 * Telegram supports a subset of markdown with specific rules
 */
export function validateTelegramMarkdown(
  text: string,
): MarkdownValidationResult {
  if (!text || typeof text !== 'string') {
    return { isValid: false, error: 'Empty or invalid text' };
  }

  try {
    // Check for balanced markdown syntax
    const checks = [
      // Check for balanced bold markers
      { regex: /\*\*/g, name: 'bold (**)', requireEven: true },
      { regex: /\*/g, name: 'italic (*)', requireEven: true },
      { regex: /`/g, name: 'code (`)', requireEven: true },
      { regex: /```/g, name: 'code block (```)', requireEven: true },
      { regex: /~/g, name: 'strikethrough (~)', requireEven: true },
      { regex: /__/g, name: 'underline (__)', requireEven: true },
    ];

    for (const check of checks) {
      const matches = text.match(check.regex);
      if (matches && check.requireEven && matches.length % 2 !== 0) {
        return {
          isValid: false,
          error: `Unbalanced ${check.name} markers`,
        };
      }
    }

    // Check for valid link syntax [text](url)
    const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g;
    const links = text.match(linkRegex);
    if (links) {
      for (const link of links) {
        const match = link.match(/\[([^\]]*)\]\(([^)]*)\)/);
        if (!match || !match[1] || !match[2]) {
          return {
            isValid: false,
            error: 'Invalid link format',
          };
        }
      }
    }

    // Check for valid user mentions @username
    const mentionRegex = /@\w+/g;
    const mentions = text.match(mentionRegex);
    if (mentions) {
      for (const mention of mentions) {
        if (mention.length < 2) {
          return {
            isValid: false,
            error: 'Invalid mention format',
          };
        }
      }
    }

    return { isValid: true };
  } catch (error) {
    return {
      isValid: false,
      error: `Validation error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Checks if text contains any markdown formatting
 */
export function hasMarkdownFormatting(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false;
  }

  const markdownPatterns = [
    /\*\*.*?\*\*/, // Bold
    /\*.*?\*/, // Italic
    /`.*?`/, // Code
    /```[\s\S]*?```/, // Code block
    /~.*?~/, // Strikethrough
    /__.*?__/, // Underline
    /\[.*?\]\(.*?\)/, // Links
    /@\w+/, // Mentions
    /^#+\s/, // Headers
    /^\s*[-*+]\s/, // Lists
    /^\s*\d+\.\s/, // Numbered lists
  ];

  return markdownPatterns.some((pattern) => pattern.test(text));
}
