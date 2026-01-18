#!/usr/bin/env node

import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const url = process.argv[2];

if (!url) {
  console.log('Usage: content.js <url>');
  console.log('\nFetches a URL and extracts readable content as markdown.');
  console.log('\nExamples:');
  console.log('  content.js https://example.com/article');
  console.log('  content.js https://docs.python.org/3/tutorial/');
  process.exit(1);
}

function htmlToMarkdown(html) {
  const turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  turndown.use(gfm);
  turndown.addRule('removeEmptyLinks', {
    filter: (node) => node.nodeName === 'A' && !node.textContent?.trim(),
    replacement: () => '',
  });
  return turndown
    .turndown(html)
    .replace(/\[\\?\[\s*\\?\]\]\([^)]*\)/g, '')
    .replace(/ +/g, ' ')
    .replace(/\s+,/g, ',')
    .replace(/\s+\./g, '.')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchPageContent(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const html = await response.text();
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article && article.content) {
    return {
      title: article.title,
      content: htmlToMarkdown(article.content),
    };
  }

  // Fallback: try to get main content
  const fallbackDoc = new JSDOM(html, { url });
  const body = fallbackDoc.window.document;
  const title = body.querySelector('title')?.textContent || url;
  body
    .querySelectorAll('script, style, noscript, nav, header, footer, aside')
    .forEach((el) => el.remove());
  const main = body.querySelector("main, article, [role='main'], .content, #content") || body.body;
  const text = main?.textContent || '';

  if (text.trim().length > 100) {
    return {
      title,
      content: text.trim(),
    };
  }

  throw new Error('Could not extract readable content from page');
}

// Main
try {
  const result = await fetchPageContent(url);

  console.log(`Title: ${result.title}`);
  console.log(`URL: ${url}`);
  console.log('');
  console.log('--- Content ---');
  console.log(result.content);
} catch (e) {
  console.error(`Error: ${e.message}`);
  process.exit(1);
}
