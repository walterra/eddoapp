---
name: searxng-search
description: Web search and content extraction via SearXNG. No API keys, no rate limits. Available in containerized agents via the eddo-chat Docker network.
---

# SearXNG Search

Local web search using SearXNG metasearch engine. No external API keys required.

## Container Environment

Inside Docker containers, SearXNG is available at `http://searxng:8080` via the `eddo-chat` network.
The `SEARXNG_URL` environment variable is automatically set.

## Search

```bash
{baseDir}/search.js "query"                    # Basic search (5 results)
{baseDir}/search.js "query" -n 10              # More results
{baseDir}/search.js "query" --content          # Include page content as markdown
{baseDir}/search.js "query" -n 3 --content     # Combined
```

## Extract Page Content

```bash
{baseDir}/content.js https://example.com/article
```

Fetches a URL and extracts readable content as markdown.

## Output Format

```
--- Result 1 ---
Title: Page Title
Link: https://example.com/page
Snippet: Description from search results
Content: (if --content flag used)
  Markdown content extracted from the page...

--- Result 2 ---
...
```

## Advantages

- ✅ No API keys required
- ✅ No rate limits
- ✅ Privacy-preserving (local instance)
- ✅ Aggregates results from multiple search engines
- ✅ Fast and reliable
- ✅ Works in containerized agents

## When to Use

- Searching for documentation or API references
- Looking up facts or current information
- Fetching content from specific URLs
- Any task requiring web search without external dependencies
