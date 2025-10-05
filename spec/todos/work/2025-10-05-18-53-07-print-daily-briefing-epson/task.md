# print the daily briefing on a local Epson TM-m30III

**Status:** In Progress
**Created:** 2025-10-05T18:53:07Z
**Started:** 2025-10-05T18:57:00Z
**Agent PID:** 81503

## Notes

### Architecture Decision: File-Based Briefing Sharing

- Telegram bot should import printer package to print briefing alongside sending it to telegram

### VS Code Auto-Formatting Issue

- `.vscode/settings.json` has `"editor.formatOnSave": true` with `prettier-plugin-organize-imports`
- This was removing imports when doing multi-step edits
- Solution: Create complete helper modules first, then import and use them atomically

### Current Status (Paused)

- CLI commands fully working and tested with real printer (192.168.1.78)
- Briefing file-based sharing implemented and working
- Next step: Complete auto-print integration in SimpleAgent (line ~325 in simple-agent.ts)
  - Need to add dynamic import of printer functions after briefing is saved
  - Check PRINTER_ENABLED config before attempting print
  - Handle errors gracefully (don't fail briefing if print fails)

### Environment Configuration

User must set in `.env`:

```
PRINTER_ENABLED=true
PRINTER_IP_ADDRESS=192.168.1.78
PRINTER_PORT=9100
PRINTER_SCHEDULE_TIME=07:00
```

## Original Todo

print the daily briefing on a local Epson TM-m30III

## Description

Add a printer service that generates and prints daily briefings to a local Epson TM-m30III thermal receipt printer. The service will:

1. **Create a reusable MCP-based briefing generator** that can be used by both Telegram bot and printer service (consolidate briefing logic)
2. **Build a printer service** using `node-thermal-printer` that formats briefings for thermal receipt output
3. **Add scheduling capability** similar to Telegram briefing scheduler (default: 7:00 AM daily)
4. **Provide manual trigger** via CLI command or web API endpoint
5. **Format briefing output** optimized for 80mm thermal paper:
   - Section headers with divider lines
   - Compact task lists with due times
   - Visual priority indicators
   - Footer with timestamp and QR code (optional: link to web app)

The printer will connect via network (Ethernet/Wi-Fi) for reliability.

## Success Criteria

- [ ] Functional: Daily briefing content is generated once and stored/cached for reuse by both Telegram and printer
- [ ] Functional: Printer service connects to Epson TM-m30III via network and successfully prints test output
- [ ] Functional: When scheduled briefing is generated for Telegram, the same content is automatically sent to printer
- [ ] Functional: Manual trigger command `/briefing now` sends identical content to both Telegram and printer
- [ ] Quality: Printer formatting converts Telegram markdown to thermal receipt format (80mm paper, 48 chars/line, readable sections)
- [ ] User validation: Manual test confirms Telegram message and printed receipt contain identical briefing content

## Implementation Plan

**Setup & Dependencies:**

- [x] Create printer_service package structure (packages/printer_service/src/, package.json, tsconfig.json)
- [x] Install dependencies: node-thermal-printer, @eddo/core-server, @eddo/core-shared, MCP SDK, commander (packages/printer_service/package.json)
- [x] Add printer environment variables to .env.example (PRINTER_IP_ADDRESS, PRINTER_ENABLED, PRINTER_SCHEDULE_TIME)
- [x] Create printer config with Zod validation (packages/printer_service/src/utils/config.ts)

**Printer Integration:**

- [x] Create printer client using node-thermal-printer (packages/printer_service/src/printer/client.ts)
- [x] Implement connection test function for Epson TM-m30III (packages/printer_service/src/printer/client.ts)
- [x] Create formatter to convert Telegram markdown to thermal receipt format (packages/printer_service/src/printer/formatter.ts)
- [x] Implement printBriefing() function with error handling (packages/printer_service/src/printer/client.ts)

**CLI Utilities for Printer Testing:**

- [x] Create CLI with commander (packages/printer_service/src/cli.ts)
- [x] Add `printer test-connection` command to verify printer connectivity (packages/printer_service/src/cli.ts)
- [x] Add `printer test-page` command to print test pattern (packages/printer_service/src/cli.ts)
- [x] Add `printer print-briefing --user <id>` command for manual briefing (packages/printer_service/src/cli.ts)
- [x] Add `printer status` command to show printer info and connection status (packages/printer_service/src/cli.ts)
- [x] Add root script: pnpm printer (package.json)

**Shared Briefing Content Solution:**

- [x] Add briefing content broadcast to SimpleAgent.agentLoop() (packages/telegram_bot/src/agent/simple-agent.ts:~295)
- [x] Detect briefing requests by checking for DAILY_BRIEFING_REQUEST_MESSAGE (packages/telegram_bot/src/agent/simple-agent.ts:131)
- [x] Save briefing to .claude/tmp/latest-briefing.json for file-based sharing (packages/telegram_bot/src/agent/simple-agent.ts:307)
- [x] Create briefing loader helper (packages/printer_service/src/printer/briefing_loader.ts)
- [x] Update CLI to load real briefings from file (packages/printer_service/src/cli.ts:95)
- [x] Add @eddo/printer-service dependency to telegram bot (packages/telegram_bot/package.json:17)
- [x] Add auto-print logic to SimpleAgent when briefing is sent (packages/telegram_bot/src/agent/simple-agent.ts:324-350)
- [x] Create printer-service index.ts to export functions (packages/printer_service/src/index.ts)
- [x] Add TypeScript project references for printer_service (tsconfig.json, packages/telegram_bot/tsconfig.json, packages/printer_service/tsconfig.json)

**Scheduling:**

- [ ] Create daily print scheduler mirroring telegram_bot pattern (packages/printer_service/src/scheduler/daily-print.ts)
- [ ] Implement per-user schedule checking with 5-minute window (packages/printer_service/src/scheduler/daily-print.ts)
- [ ] Add daily reset tracking to prevent duplicate prints (packages/printer_service/src/scheduler/daily-print.ts)

**Scripts:**

- [x] Add root scripts: pnpm dev:printer, pnpm build:printer (package.json:96,102)
- [ ] Add printer service to main pnpm dev command (package.json)

**Testing:**

- [ ] Automated test: Printer connection test successfully detects Epson TM-m30III
- [ ] Automated test: Markdown to thermal format conversion produces correct layout
- [x] User test: Run `pnpm printer test-connection` and verify connection success - PASSED
- [x] User test: Run `pnpm printer test-page` and verify test page prints - PASSED
- [x] User test: Run `pnpm printer print-briefing --user <id>` and verify briefing prints - PASSED
- [ ] User test: Verify `/briefing now` in Telegram auto-prints to printer
- [ ] User test: Verify scheduled briefing prints at configured time with same content as Telegram message
