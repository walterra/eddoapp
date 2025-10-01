---
'eddo-app': patch
'@eddo/core-client': patch
'@eddo/core-server': patch
'@eddo/core-shared': patch
'@eddo/mcp-server': patch
'@eddo/telegram-bot': patch
'@eddo/web-client': patch
---

Migrate from @trivago/prettier-plugin-sort-imports to prettier-plugin-organize-imports for improved import formatting. This change standardizes import organization across all packages using TypeScript's language service API, providing consistent type import handling and automatic alphabetical sorting within logical groups.
