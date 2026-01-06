# Changelog

## 0.5.0

### Minor Changes

- [#398](https://github.com/walterra/eddoapp/pull/398) [`680d0d5`](https://github.com/walterra/eddoapp/commit/680d0d5de40dff00969574bffc446c9d65e6a31f) - Add bulk due date actions via clickable column header in table view

- [#396](https://github.com/walterra/eddoapp/pull/396) [`1adaeac`](https://github.com/walterra/eddoapp/commit/1adaeacdacb4615d8237d98227bdca80db5a0a35) - Add email to todo sync with Gmail OAuth integration

### Patch Changes

- [#393](https://github.com/walterra/eddoapp/pull/393) [`eab141a`](https://github.com/walterra/eddoapp/commit/eab141a680f6d92d7c36eca2892d538fed8b4e79) - Bump @tanstack/react-query from 5.90.5 to 5.90.14

- [#391](https://github.com/walterra/eddoapp/pull/391) [`03ab75f`](https://github.com/walterra/eddoapp/commit/03ab75fd8f06c097d1a11134d188f9c89d50c51b) - Bump @vitejs/plugin-react from 5.0.4 to 5.1.2

- [`3aa3641`](https://github.com/walterra/eddoapp/commit/3aa3641a77c4f67674f3740186a6993e203f655a) - Patch CVE-2026-0621 ReDoS vulnerability in @modelcontextprotocol/sdk

- [#394](https://github.com/walterra/eddoapp/pull/394) [`c99066a`](https://github.com/walterra/eddoapp/commit/c99066a03ce2e1a6440a282211803b1bf63ba3ec) - Bump prettier from 3.6.2 to 3.7.4

- [#395](https://github.com/walterra/eddoapp/pull/395) [`8a52993`](https://github.com/walterra/eddoapp/commit/8a52993c3f8a6749db039dca2594ecfe806edbc1) - Bump typescript-eslint from 8.44.1 to 8.50.0

## 0.4.0

### Minor Changes

- [#305](https://github.com/walterra/eddoapp/pull/305) [`b77b038`](https://github.com/walterra/eddoapp/commit/b77b038e8acb2ae6a246a77263ddaaa9af72e3b7) - Add automated backup scheduler with retention policy management

- [#379](https://github.com/walterra/eddoapp/pull/379) [`239c1ea`](https://github.com/walterra/eddoapp/commit/239c1ea333b08c7c207d30ab86f67f2a18b2f6c0) - Add getBriefingData and getRecapData MCP tools for efficient single-call data aggregation, reducing agent iterations from 6+ to 2

- [#376](https://github.com/walterra/eddoapp/pull/376) [`58efd16`](https://github.com/walterra/eddoapp/commit/58efd1668162bd9055811bd053b64f8888a54eaa) - Add dark mode as first-class citizen with manual theme toggle (system/light/dark), consistent neutral color palette across all components, and user preference persistence

- [#367](https://github.com/walterra/eddoapp/pull/367) [`5708f09`](https://github.com/walterra/eddoapp/commit/5708f099a29896e8161809b6d67fa53e7dedb484) - Add design token system with Inter font and migrate all components to semantic color tokens

- [#382](https://github.com/walterra/eddoapp/pull/382) [`80860b9`](https://github.com/walterra/eddoapp/commit/80860b9ba8d4a8270828a3e8c6c666ba0767aae0) - Add server-side observability with OpenTelemetry instrumentation for all backend services (telegram-bot, web-api, mcp-server) including distributed tracing, structured logging with Pino, and CouchDB metrics collection

- [#304](https://github.com/walterra/eddoapp/pull/304) [`f74f577`](https://github.com/walterra/eddoapp/commit/f74f5777cb25ae769acc363933956823a4b5c76e) - Add real-time user preferences sync across browser tabs via Server-Sent Events (SSE)

- [#349](https://github.com/walterra/eddoapp/pull/349) [`c65af86`](https://github.com/walterra/eddoapp/commit/c65af8618d1d43a1350af264869762713a5c132a) - Add "Remember me" checkbox to login page for persistent authentication sessions

- [#384](https://github.com/walterra/eddoapp/pull/384) [`a4c71b4`](https://github.com/walterra/eddoapp/commit/a4c71b44ee24603389d14286137542c1775238cd) - Add RSS feed sync integration with autodiscovery, Web UI, and Telegram bot commands

### Patch Changes

- [#381](https://github.com/walterra/eddoapp/pull/381) [`208dc2a`](https://github.com/walterra/eddoapp/commit/208dc2a7e915a5511d2f7c51980f0e784d2135ab) - Add integration test for completed todos with due date range filtering

- [#368](https://github.com/walterra/eddoapp/pull/368) [`0c19c69`](https://github.com/walterra/eddoapp/commit/0c19c697ebe9df8cfa8922ed6dc61981973e945c) - Add design token system for consistent component styling and fix WebKit hover compatibility

- [#306](https://github.com/walterra/eddoapp/pull/306) [`a206fe5`](https://github.com/walterra/eddoapp/commit/a206fe554825886db0e008493d82698489a79332) - Refactor backup/restore scripts to use CLI flags instead of environment variables and add disaster recovery documentation

- [#366](https://github.com/walterra/eddoapp/pull/366) [`6d596f0`](https://github.com/walterra/eddoapp/commit/6d596f0931ce55d52344f2ddfdc4fe8707601211) - Add consistent hover and focus states to all interactive elements for improved keyboard accessibility

- [#365](https://github.com/walterra/eddoapp/pull/365) [`06e57ed`](https://github.com/walterra/eddoapp/commit/06e57ed63e468e3eae1cdd217e4c94b5c91f2678) - Fix ESLint complexity warnings and improve toggleTodoCompletion reliability

- [#297](https://github.com/walterra/eddoapp/pull/297) [`a0f5216`](https://github.com/walterra/eddoapp/commit/a0f52162ba5f1505b3873ae4a3e1666e51208a7e) - Fix PR reviews not marked complete when merged by adding `reviewed-by:@me` query to GitHub sync

- [#326](https://github.com/walterra/eddoapp/pull/326) [`2d602bb`](https://github.com/walterra/eddoapp/commit/2d602bbe4a6369c94f4e1d0828816c434429cbd2) - Fix high severity qs DoS vulnerability via pnpm override

- [#377](https://github.com/walterra/eddoapp/pull/377) [`cdb4fb9`](https://github.com/walterra/eddoapp/commit/cdb4fb9b6e93647c6c2868c16d421cda3668b25e) - Fix telegram bot sending hallucinated content before tool results by implementing STATUS message pattern for intermediate user feedback

- [#308](https://github.com/walterra/eddoapp/pull/308) [`7022f3e`](https://github.com/walterra/eddoapp/commit/7022f3eaec6d0198b2cdebd4b0517d8344313a5e) - Fix user preferences not loading after login until page refresh

- [#311](https://github.com/walterra/eddoapp/pull/311) [`841877d`](https://github.com/walterra/eddoapp/commit/841877d59e6d63a4d571f4097b7b00e7fda42c62) - Bump flowbite from 3.1.2 to 4.0.1

- [#380](https://github.com/walterra/eddoapp/pull/380) [`e48cb35`](https://github.com/walterra/eddoapp/commit/e48cb351d3972a875607c9289dcaeeb9e3e8c2bd) - Add getTodo MCP tool for fetching single todo by ID

- [#302](https://github.com/walterra/eddoapp/pull/302) [`5d95862`](https://github.com/walterra/eddoapp/commit/5d9586232163907d2490c0c3207e2783fdb97bfd) - Remove unused exports and dead code identified by knip analysis

- [#310](https://github.com/walterra/eddoapp/pull/310) [`9fdd9f7`](https://github.com/walterra/eddoapp/commit/9fdd9f702b9d5f782d1929e7ad454ffd333eefd7) - Add loading spinners and empty states to TodoBoard and TodoTable views

- [#300](https://github.com/walterra/eddoapp/pull/300) [`119b61e`](https://github.com/walterra/eddoapp/commit/119b61e990a8de447abf5757cfc1dd20d0a3b476) - Fix MCP server missing database indexes (externalId-index, tags-index)

- [#378](https://github.com/walterra/eddoapp/pull/378) [`d6dbfd9`](https://github.com/walterra/eddoapp/commit/d6dbfd92ee3f54755a96035f43987d7b8071e9f1) - Block reserved usernames during registration to prevent database naming collisions

- [#309](https://github.com/walterra/eddoapp/pull/309) [`8283193`](https://github.com/walterra/eddoapp/commit/8283193589da510936b2605cbf2a24c7482368c1) - Add test coverage reporting with CI threshold enforcement

- [#370](https://github.com/walterra/eddoapp/pull/370) [`8b32f15`](https://github.com/walterra/eddoapp/commit/8b32f150013c34285b53cb29ae2944c9fa39afe7) - Replace todo edit modal with slide-in flyout panel for better editing experience

## 0.3.0

### Minor Changes

- [#283](https://github.com/walterra/eddoapp/pull/283) [`63e3c46`](https://github.com/walterra/eddoapp/commit/63e3c460c040aecd49f27eac5450c9255e8033cf) - Add GitHub API rate limit handling with automatic retry, exponential backoff, and monitoring

- [#295](https://github.com/walterra/eddoapp/pull/295) [`f590f19`](https://github.com/walterra/eddoapp/commit/f590f195f3c309f2620d566c12eca0db50219738) - Migrate all UI actions to TanStack Query mutations for consistent state management

### Patch Changes

- [#287](https://github.com/walterra/eddoapp/pull/287) [`88e2fb6`](https://github.com/walterra/eddoapp/commit/88e2fb6e38a26586b2b4363cb6ee8b4043057188) - Fix filter dropdowns being cut off by adding scrollable overflow when content exceeds viewport space

- [#277](https://github.com/walterra/eddoapp/pull/277) [`4150888`](https://github.com/walterra/eddoapp/commit/41508884dd0725e5621782c1ab0e9d3c6f016250) - Implement fixed versioning with unified releases and aggregated changelogs

- [#284](https://github.com/walterra/eddoapp/pull/284) [`e7f1bca`](https://github.com/walterra/eddoapp/commit/e7f1bcae39706f2ca544597862dc581515273149) - Optimize database queries with proper indexing to eliminate full table scans and reduce CouchDB CPU usage during GitHub sync operations

- [#288](https://github.com/walterra/eddoapp/pull/288) [`7325fa0`](https://github.com/walterra/eddoapp/commit/7325fa03276a148abb3e1f651deea8a27176e787) - Add testcontainers for automated CouchDB test infrastructure - no manual database setup required

## 0.1.0

### Minor Changes

- 4221a64: Add automated CHANGELOG system with changesets, commitizen, and commitlint
- a309824: Add thermal printer support for daily briefings on Epson TM-m30III

### Patch Changes

- 600932a: Migrate to prettier-plugin-organize-imports for improved import formatting
- 92a6b85: Add ESLint rule to prohibit wildcard barrel exports

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

### Changed

### Deprecated

### Removed

### Fixed

### Security
