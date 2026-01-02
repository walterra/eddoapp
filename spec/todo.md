# Todo Items

## Design Improvements

### Phase 1: Foundation

- Define design tokens (colors, spacing, typography scale) - [#351](https://github.com/walterra/eddoapp/issues/351)
- Implement dark mode as first-class citizen - [#352](https://github.com/walterra/eddoapp/issues/352)
- Increase whitespace throughout the interface - [#354](https://github.com/walterra/eddoapp/issues/354)
- Audit and unify component consistency - [#364](https://github.com/walterra/eddoapp/issues/364)

### Phase 2: Polish

- Add micro-interactions for todo completion and time tracking - [#355](https://github.com/walterra/eddoapp/issues/355)
- Implement skeleton loaders for data fetching - [#356](https://github.com/walterra/eddoapp/issues/356)
- Refine Kanban card design (shadows, spacing, typography) - [#357](https://github.com/walterra/eddoapp/issues/357)
- Add command palette (Cmd+K) - [#358](https://github.com/walterra/eddoapp/issues/358)
- Implement optimistic UI updates for todo actions - [#363](https://github.com/walterra/eddoapp/issues/363)

### Phase 3: Delight

- Animate view transitions (kanban ↔ table) - [#359](https://github.com/walterra/eddoapp/issues/359)
- Design meaningful empty states - [#360](https://github.com/walterra/eddoapp/issues/360)
- Add keyboard shortcut hints throughout UI - [#361](https://github.com/walterra/eddoapp/issues/361)
- Consider collapsible sidebar navigation - [#362](https://github.com/walterra/eddoapp/issues/362)

## Features

- Improve briefing prompt to not repeat itself - [#328](https://github.com/walterra/eddoapp/issues/328)
- Workflow to proceed with read-later items - [#329](https://github.com/walterra/eddoapp/issues/329)
- Due date quick actions / bulk actions - [#330](https://github.com/walterra/eddoapp/issues/330)
- User preset filters - CRUD for saved filter configurations - [#331](https://github.com/walterra/eddoapp/issues/331)
- Selective GitHub Force Resync - Fine-grained field selection - [#332](https://github.com/walterra/eddoapp/issues/332)
- Proper timezone support - [#333](https://github.com/walterra/eddoapp/issues/333)
- GTD tags as dedicated attribute - TodoAlpha5 migration - [#334](https://github.com/walterra/eddoapp/issues/334)
- Persistent chat history for telegram-bot - [#335](https://github.com/walterra/eddoapp/issues/335)
- Chat interface in the web-ui - [#336](https://github.com/walterra/eddoapp/issues/336)

## Bugs

- User registry naming collision risk - [#337](https://github.com/walterra/eddoapp/issues/337)
- Fix timezone handling in recap date calculations - [#340](https://github.com/walterra/eddoapp/issues/340)
- Fix or remove two-message pattern instruction - [#345](https://github.com/walterra/eddoapp/issues/345)

## Infrastructure & Code Quality

- Implement Stoker middleware for consistent error responses - [#338](https://github.com/walterra/eddoapp/issues/338)
- Add proper caching headers and asset optimization - [#339](https://github.com/walterra/eddoapp/issues/339)
- Add empty results handling to recap prompt - [#341](https://github.com/walterra/eddoapp/issues/341)
- Verify index selection logic for completion date ranges - [#342](https://github.com/walterra/eddoapp/issues/342)
- Update help text to explain automatic recap scheduling - [#343](https://github.com/walterra/eddoapp/issues/343)
- Add validation that completedFrom < completedTo in MCP tool - [#344](https://github.com/walterra/eddoapp/issues/344)
- Add Zod datetime validation for date parameters in MCP tool - [#346](https://github.com/walterra/eddoapp/issues/346)

## Testing

- Add test for completed:true + date range combination - [#347](https://github.com/walterra/eddoapp/issues/347)
- Update test fixtures to include printBriefing/printRecap fields - [#348](https://github.com/walterra/eddoapp/issues/348)

## Security

- Add error boundaries and proper error handling - [#25](https://github.com/walterra/eddoapp/issues/25)
- Configure Content Security Policy headers - [#26](https://github.com/walterra/eddoapp/issues/26)
- Add input validation and XSS prevention - [#29](https://github.com/walterra/eddoapp/issues/29)

## Performance & Accessibility

- Add accessibility features (focus management, ARIA live regions) - [#31](https://github.com/walterra/eddoapp/issues/31)
- Configure bundle analysis and performance monitoring - [#32](https://github.com/walterra/eddoapp/issues/32)

## Data & Backup

- Support backup/restore - [#13](https://github.com/walterra/eddoapp/issues/13)

## Aspirational Code Quality Standards

These are quality improvements to consider for future development:

- Result/Either pattern for functional error handling
- Structured logging with correlation IDs
- AbortController signal handling for cancellable async operations
- Integration tests with TestContainers for external dependencies
- Property-based testing with fast-check for edge cases
- OpenTelemetry spans with proper error recording and semantic conventions
- Graceful shutdown with cleanup hooks
