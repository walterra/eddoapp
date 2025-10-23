# @eddo/telegram-bot

## 0.2.0

### Minor Changes

- a309824: Add thermal printer support for daily briefings on Epson TM-m30III. This feature enables automatic printing of daily briefings to a networked thermal receipt printer, with user-configurable preferences and integration into the Telegram bot workflow.

### Patch Changes

- 93b491e: Fix daily briefings to include gtd:calendar tagged appointments. Updated DAILY_BRIEFING_REQUEST_MESSAGE to explicitly query for calendar events and display them with time prefixes.
- 600932a: Migrate from @trivago/prettier-plugin-sort-imports to prettier-plugin-organize-imports for improved import formatting. This change standardizes import organization across all packages using TypeScript's language service API, providing consistent type import handling and automatic alphabetical sorting within logical groups.
- Updated dependencies [462b542]
- Updated dependencies [600932a]
- Updated dependencies [a309824]
- Updated dependencies [9e3dd6a]
  - @eddo/core-shared@0.0.2
  - @eddo/core-server@0.0.2
  - @eddo/printer-service@0.2.0
