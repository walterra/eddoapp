/**
 * Format briefing content from Telegram markdown to thermal printer format
 * 80mm paper = 48 characters per line at default font
 */

const MAX_LINE_WIDTH = 48;

/**
 * Wrap text to fit thermal printer width
 */
function wrapText(text: string, maxWidth: number = MAX_LINE_WIDTH): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Convert Telegram markdown to plain text suitable for thermal printing
 */
export function formatForThermalPrinter(telegramMarkdown: string): string {
  let formatted = telegramMarkdown;

  // Remove Telegram-specific markdown formatting
  // Bold: *text* or **text**
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '$1');
  formatted = formatted.replace(/\*([^*]+)\*/g, '$1');

  // Italic: _text_ or __text__
  formatted = formatted.replace(/__([^_]+)__/g, '$1');
  formatted = formatted.replace(/_([^_]+)_/g, '$1');

  // Strikethrough: ~text~
  formatted = formatted.replace(/~([^~]+)~/g, '$1');

  // Inline code: `code`
  formatted = formatted.replace(/`([^`]+)`/g, '$1');

  // Code blocks: ```code```
  formatted = formatted.replace(/```[\s\S]*?```/g, (match) => {
    return match.replace(/```/g, '');
  });

  // Links: [text](url) -> text (url)
  formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

  // Headers: convert markdown headers to uppercase with separator
  formatted = formatted.replace(/^#+\s+(.+)$/gm, (match, content) => {
    return `\n${content.toUpperCase()}\n${'='.repeat(Math.min(content.length, MAX_LINE_WIDTH))}`;
  });

  // Wrap long lines
  const lines = formatted.split('\n');
  const wrappedLines: string[] = [];

  for (const line of lines) {
    if (line.length <= MAX_LINE_WIDTH) {
      wrappedLines.push(line);
    } else {
      wrappedLines.push(...wrapText(line));
    }
  }

  return wrappedLines.join('\n');
}

/**
 * Format briefing with enhanced structure for thermal printer
 */
export function formatBriefingForPrint(content: string): string {
  // First convert markdown
  let formatted = formatForThermalPrinter(content);

  // Add visual separators for sections
  formatted = formatted.replace(
    /^([\u{1F305}\u{1F4C5}\u{26A0}\u{2705}\u{23F3}\u{23F8}\u{1F4CB}\u{1F9E0}].+)$/gmu,
    (match) => {
      return `\n${match}\n${'-'.repeat(MAX_LINE_WIDTH)}`;
    },
  );

  // Format bullet points for better readability
  formatted = formatted.replace(/^[•·]/gm, '  -');

  // Ensure proper spacing between sections
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted;
}
