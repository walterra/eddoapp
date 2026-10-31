import type { MessageEntity } from 'grammy/types';
import { fromMarkdown } from 'mdast-util-from-markdown';

import type { TelegramText } from '@eddo/assistant-server/delivery_state';

interface MarkdownNode {
  type: string;
  value?: string;
  children?: readonly MarkdownNode[];
  url?: string;
  identifier?: string;
  alt?: string | null;
  lang?: string | null;
  ordered?: boolean | null;
  start?: number | null;
}

type TelegramStyle =
  | { type: 'bold' | 'italic' | 'code' | 'blockquote' }
  | { type: 'pre'; language?: string }
  | { type: 'text_link'; url: string };

type Definitions = ReadonlyMap<string, string>;
type NodeRenderer = (node: MarkdownNode, definitions: Definitions) => TelegramText;

function plain(text = ''): TelegramText {
  return { text, entities: [] };
}

function join(parts: readonly TelegramText[]): TelegramText {
  const result = plain();
  for (const part of parts) {
    const offset = result.text.length;
    result.text += part.text;
    result.entities.push(
      ...part.entities.map((entity) => ({ ...entity, offset: entity.offset + offset })),
    );
  }
  return result;
}

/** Excludes code spans from enclosing styles to satisfy Telegram entity nesting rules. */
function styled(content: TelegramText, style: TelegramStyle): TelegramText {
  let offset = 0;
  const entities = content.entities.filter((entity) => entity.type !== style.type);
  const code = entities
    .filter((entity) => entity.type === 'code' || entity.type === 'pre')
    .sort((left, right) => left.offset - right.offset);
  for (const range of [...code, { offset: content.text.length, length: 0 }]) {
    if (range.offset > offset) entities.push({ ...style, offset, length: range.offset - offset });
    offset = range.offset + range.length;
  }
  return { text: content.text, entities };
}

function children(node: MarkdownNode, definitions: Definitions): TelegramText {
  return join((node.children ?? []).map((child) => renderNode(child, definitions)));
}

function trimText(content: TelegramText): TelegramText {
  const codeEnd = content.entities
    .filter((entity) => entity.type === 'code' || entity.type === 'pre')
    .reduce((end, entity) => Math.max(end, entity.offset + entity.length), 0);
  const text = content.text.slice(0, Math.max(content.text.trimEnd().length, codeEnd));
  return { text, entities: telegramChunkEntities(content.entities, 0, text.length) };
}

function block(content: TelegramText): TelegramText {
  return join([content, plain('\n\n')]);
}

function link(content: TelegramText, url?: string): TelegramText {
  if (!url || !/^(https?:|mailto:|tg:)/i.test(url)) return content;
  return styled(content, { type: 'text_link', url });
}

function renderList(node: MarkdownNode, definitions: Definitions): TelegramText {
  const items = (node.children ?? []).map((item, index) => {
    const prefix = node.ordered ? `${(node.start ?? 1) + index}. ` : '• ';
    const rendered = trimText(children(item, definitions));
    return join([plain(prefix), rendered, plain('\n')]);
  });
  return join([...items, plain('\n')]);
}

const renderers: Readonly<Record<string, NodeRenderer>> = {
  text: (node) => plain(node.value),
  html: (node) => plain(node.value),
  inlineCode: (node) => styled(plain(node.value), { type: 'code' }),
  code: (node) =>
    block(styled(plain(node.value), { type: 'pre', language: node.lang ?? undefined })),
  strong: (node, definitions) => styled(children(node, definitions), { type: 'bold' }),
  emphasis: (node, definitions) => styled(children(node, definitions), { type: 'italic' }),
  paragraph: (node, definitions) => block(children(node, definitions)),
  heading: (node, definitions) => block(styled(children(node, definitions), { type: 'bold' })),
  blockquote: (node, definitions) => styled(children(node, definitions), { type: 'blockquote' }),
  link: (node, definitions) => link(children(node, definitions), node.url),
  linkReference: (node, definitions) =>
    link(children(node, definitions), definitions.get(node.identifier ?? '')),
  image: (node) => link(plain(node.alt || node.url), node.url),
  imageReference: (node, definitions) =>
    link(plain(node.alt ?? undefined), definitions.get(node.identifier ?? '')),
  list: renderList,
  break: () => plain('\n'),
  thematicBreak: () => plain('—\n\n'),
  definition: () => plain(),
};

function renderNode(node: MarkdownNode, definitions: Definitions): TelegramText {
  return renderers[node.type]?.(node, definitions) ?? children(node, definitions);
}

/** Renders Markdown as text and UTF-16 Telegram entities without interpreting raw HTML. */
export function formatTelegramText(markdown: string): TelegramText {
  try {
    const root = fromMarkdown(markdown);
    const definitions = new Map(
      root.children.flatMap((node) =>
        node.type === 'definition' ? [[node.identifier, node.url] as const] : [],
      ),
    );
    const result = trimText(children(root, definitions));
    if (!result.text) return plain(markdown);
    result.entities.sort((left, right) => left.offset - right.offset);
    return result;
  } catch {
    return plain(markdown);
  }
}

/** Clips entities to a delivered chunk and rebases their UTF-16 offsets. */
export function telegramChunkEntities(
  entities: readonly MessageEntity[],
  offset: number,
  length: number,
): MessageEntity[] {
  return entities.flatMap((entity) => {
    const start = Math.max(offset, entity.offset);
    const end = Math.min(offset + length, entity.offset + entity.length);
    return end > start ? [{ ...entity, offset: start - offset, length: end - start }] : [];
  });
}
