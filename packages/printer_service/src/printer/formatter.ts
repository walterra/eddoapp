/**
 * Format briefing content from Telegram markdown to thermal printer format
 * 80mm paper = 48 characters per line at default font
 */

const MAX_LINE_WIDTH = 48;

/**
 * Strip all emojis from text for thermal printer compatibility
 * Covers: emoticons, symbols, pictographs, transport, flags, skin tones, ZWJ sequences
 */
function stripEmojis(text: string): string {
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}]/gu, // Emoticons
      '',
    )
    .replace(
      /[\u{1F300}-\u{1F5FF}]/gu, // Symbols & Pictographs
      '',
    )
    .replace(
      /[\u{1F680}-\u{1F6FF}]/gu, // Transport & Map
      '',
    )
    .replace(
      /[\u{1F700}-\u{1F77F}]/gu, // Alchemical Symbols
      '',
    )
    .replace(
      /[\u{1F780}-\u{1F7FF}]/gu, // Geometric Shapes Extended
      '',
    )
    .replace(
      /[\u{1F800}-\u{1F8FF}]/gu, // Supplemental Arrows-C
      '',
    )
    .replace(
      /[\u{1F900}-\u{1F9FF}]/gu, // Supplemental Symbols and Pictographs
      '',
    )
    .replace(
      /[\u{1FA00}-\u{1FA6F}]/gu, // Chess Symbols
      '',
    )
    .replace(
      /[\u{1FA70}-\u{1FAFF}]/gu, // Symbols and Pictographs Extended-A
      '',
    )
    .replace(
      /[\u{2600}-\u{26FF}]/gu, // Miscellaneous Symbols
      '',
    )
    .replace(
      /[\u{2700}-\u{27BF}]/gu, // Dingbats
      '',
    )
    .replace(
      /[\u{1F1E0}-\u{1F1FF}]/gu, // Regional Indicator Symbols (flags)
      '',
    )
    .replace(
      /[\u{FE00}-\u{FE0F}]/gu, // Variation Selectors
      '',
    )
    .replace(
      /[\u{1F000}-\u{1F02F}]/gu, // Mahjong Tiles
      '',
    )
    .replace(
      /[\u{1F0A0}-\u{1F0FF}]/gu, // Playing Cards
      '',
    )
    .replace(
      /[\u{E0020}-\u{E007F}]/gu, // Tags
      '',
    )
    .replace(
      /[\u{200D}]/gu, // Zero Width Joiner (for ZWJ sequences)
      '',
    )
    .replace(
      /[\u{1F3FB}-\u{1F3FF}]/gu, // Skin tone modifiers
      '',
    );
}

/** Break a long word into chunks of maxWidth */
function breakLongWord(word: string, maxWidth: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < word.length; i += maxWidth) {
    chunks.push(word.slice(i, i + maxWidth));
  }
  return chunks;
}

/** Process a long word that exceeds maxWidth */
function processLongWord(
  word: string,
  currentLine: string,
  lines: string[],
  maxWidth: number,
): { newCurrentLine: string } {
  if (currentLine) {
    lines.push(currentLine);
  }
  lines.push(...breakLongWord(word, maxWidth));
  return { newCurrentLine: '' };
}

/** Process a normal word that fits within maxWidth */
function processNormalWord(
  word: string,
  currentLine: string,
  lines: string[],
  maxWidth: number,
): { newCurrentLine: string } {
  const testLine = currentLine ? `${currentLine} ${word}` : word;

  if (testLine.length <= maxWidth) {
    return { newCurrentLine: testLine };
  }

  if (currentLine) {
    lines.push(currentLine);
  }
  return { newCurrentLine: word };
}

/**
 * Wrap text to fit thermal printer width
 */
function wrapText(text: string, maxWidth: number = MAX_LINE_WIDTH): string[] {
  if (text.trim() === '') {
    return [''];
  }

  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const result =
      word.length > maxWidth
        ? processLongWord(word, currentLine, lines, maxWidth)
        : processNormalWord(word, currentLine, lines, maxWidth);
    currentLine = result.newCurrentLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Convert Telegram markdown to plain text suitable for thermal printing
 */
function formatForThermalPrinter(telegramMarkdown: string): string {
  // Strip emojis first
  let formatted = stripEmojis(telegramMarkdown);

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
  // First convert markdown and replace emojis
  let formatted = formatForThermalPrinter(content);

  // Format bullet points for better readability
  formatted = formatted.replace(/^[•·]/gm, '  -');

  // Ensure proper spacing between sections
  formatted = formatted.replace(/\n{3,}/g, '\n\n');

  return formatted;
}
