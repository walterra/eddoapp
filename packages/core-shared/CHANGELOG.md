# @eddo/core-shared

## 0.0.2

### Patch Changes

- 462b542: Consolidate database structure definitions into core-shared package
- 600932a: Migrate from @trivago/prettier-plugin-sort-imports to prettier-plugin-organize-imports for improved import formatting. This change standardizes import organization across all packages using TypeScript's language service API, providing consistent type import handling and automatic alphabetical sorting within logical groups.
- a309824: Add thermal printer support for daily briefings on Epson TM-m30III. This feature enables automatic printing of daily briefings to a networked thermal receipt printer, with user-configurable preferences and integration into the Telegram bot workflow.
- 9e3dd6a: Split monolithic \_design/todos into separate design documents
