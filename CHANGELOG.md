# Changelog

## 0.8.0

### Minor Changes

- [`ca85244`](https://github.com/walterra/eddoapp/commit/ca852443313f58636cb4f58556d4bd4cdc7dc84f) - Add Graphviz-based dependency graph layout with server-side rendering and reduced web bundle size.

- [#513](https://github.com/walterra/eddoapp/pull/513) [`36cb455`](https://github.com/walterra/eddoapp/commit/36cb45519cebfbe57d608ce6bc522f19bc382e85) - Require MCP API keys and add a chat reasoning visibility toggle.

- [#510](https://github.com/walterra/eddoapp/pull/510) [`52d3df3`](https://github.com/walterra/eddoapp/commit/52d3df3367bb33317e7f00e8a97bf0607034f458) - Add UI actions for todo relationships, inline editing, and search results.

## 0.7.0

### Minor Changes

- [#490](https://github.com/walterra/eddoapp/pull/490) [`2805ffb`](https://github.com/walterra/eddoapp/commit/2805ffbc9a44e27fee7d08fea4f4f3d3732acaf4) - Add bundle splitting and enhanced CI bundle size reporting with per-chunk breakdown

- [#473](https://github.com/walterra/eddoapp/pull/473) [`2fe343d`](https://github.com/walterra/eddoapp/commit/2fe343d435faa3a602fddcee93a9ba62fd05a3c3) - Add chat-agent package with skills and extensions for pi coding agent integration

- [#472](https://github.com/walterra/eddoapp/pull/472) [`12d151b`](https://github.com/walterra/eddoapp/commit/12d151b7646a0ef2cfa527eebdf29179244f7a51) - Add chat API routes for AI agent sessions

- [#467](https://github.com/walterra/eddoapp/pull/467) [`9af4c89`](https://github.com/walterra/eddoapp/commit/9af4c89acd36917a15df5adfdb55364c7292089c) - Add chat database types and API for message storage

- [#474](https://github.com/walterra/eddoapp/pull/474) [`06cd960`](https://github.com/walterra/eddoapp/commit/06cd9607be6a0dd366a65aacd462dd203fec673f) - Add chat UI components with assistant-ui library integration for AI agent sessions

- [#470](https://github.com/walterra/eddoapp/pull/470) [`7d0b85e`](https://github.com/walterra/eddoapp/commit/7d0b85ef98f283e78cd28c4f8ef81e5423c9942b) - Add docker container and git repo management modules

- [#471](https://github.com/walterra/eddoapp/pull/471) [`dec90cf`](https://github.com/walterra/eddoapp/commit/dec90cf158d835fd6d0f1b224c3751e805de8815) - Add Elasticsearch-based full-text search for todos

- [#477](https://github.com/walterra/eddoapp/pull/477) [`0c14529`](https://github.com/walterra/eddoapp/commit/0c14529afded4a19e88a52ab62fa69ef49961b9b) - Add `pnpm dev:setup` wizard, `pnpm dev:doctor` diagnostic tool, and `pnpm dev:purge` cleanup command for improved developer experience

- [#464](https://github.com/walterra/eddoapp/pull/464) [`112e60e`](https://github.com/walterra/eddoapp/commit/112e60e4892c57e80975b7bb6a5d4d9db02570d2) - Add image upload support for todos with CouchDB native attachments

- [#475](https://github.com/walterra/eddoapp/pull/475) [`a44f14d`](https://github.com/walterra/eddoapp/commit/a44f14d3f30f69d03c4e17d29f713adf4078d671) - Add SearXNG search skill and Docker management for chat agent

- [#469](https://github.com/walterra/eddoapp/pull/469) [`c392301`](https://github.com/walterra/eddoapp/commit/c392301af84c8719b35ef44e44d1cc57c5a35b20) - Add theming system and RPG2 theme for todo graph visualization

### Patch Changes

- [#468](https://github.com/walterra/eddoapp/pull/468) [`de7d0ba`](https://github.com/walterra/eddoapp/commit/de7d0babd08bbc6be808f653fa1719d04ea84251) - Add emailSyncError field to UserPreferences for tracking email sync failures

- [#465](https://github.com/walterra/eddoapp/pull/465) [`0237953`](https://github.com/walterra/eddoapp/commit/0237953642973702f5ceb391885fc974392581cf) - Fix complete button in table-view and improve table layout on narrow screens

- [#460](https://github.com/walterra/eddoapp/pull/460) [`60766c3`](https://github.com/walterra/eddoapp/commit/60766c3e2098ca73aa1acfb2736464994204d975) - Add MapReduce views for O(1) tag/context aggregation and batch subtask counts

- [#462](https://github.com/walterra/eddoapp/pull/462) [`3e0fb46`](https://github.com/walterra/eddoapp/commit/3e0fb4678b3b242d43347edf9254386557f41462) - Migrate table view to TanStack Table with virtualization support for improved performance

## 0.6.0

### Minor Changes

- [#417](https://github.com/walterra/eddoapp/pull/417) [`287c11c`](https://github.com/walterra/eddoapp/commit/287c11c509dbd173f4cc20f99b37dec50569f1da) - Add client-side Real User Monitoring (RUM) with OpenTelemetry browser SDK

- [#418](https://github.com/walterra/eddoapp/pull/418) [`8a3d8c4`](https://github.com/walterra/eddoapp/commit/8a3d8c4783a8edfc579a9064dc3deda1818bf7c5) - Add optional metadata field to todos for extensible key-value storage (agent:, github:, rss: namespaces)

- [#407](https://github.com/walterra/eddoapp/pull/407) [`ba4bc49`](https://github.com/walterra/eddoapp/commit/ba4bc4970bb0a3dc9135e2362304fcf0afc80759) - Add notes feature to todos for tracking progress and decisions

- [#406](https://github.com/walterra/eddoapp/pull/406) [`89b757f`](https://github.com/walterra/eddoapp/commit/89b757fe484bf3dc40bc9153ab51c93d42fe2f9c) - Add audit log system tracking all todo CRUD operations with real-time Activity sidebar

- [#457](https://github.com/walterra/eddoapp/pull/457) [`8ba160d`](https://github.com/walterra/eddoapp/commit/8ba160d444d65e4399ca2677fd260414f5399af7) - Add blockedBy field for task dependencies with graph visualization and flyout UI

- [#458](https://github.com/walterra/eddoapp/pull/458) [`0f6f999`](https://github.com/walterra/eddoapp/commit/0f6f99964c8f426d163fd2e8e2ca0aa2848ada6b) - Email sync: Move processed emails to eddo-processed folder/label for efficiency

- [#399](https://github.com/walterra/eddoapp/pull/399) [`0052a3a`](https://github.com/walterra/eddoapp/commit/0052a3abc1fd54170de02952d84a75e61dcb6ed5) - Add filter presets for saving and quickly applying filter configurations

- [#433](https://github.com/walterra/eddoapp/pull/433) [`5c5ca59`](https://github.com/walterra/eddoapp/commit/5c5ca59acda3e1eba50155426bd5a688a348f88e) - Add graph view for visualizing todo relationships, agent sessions, and file associations with force-directed d3 layout

- [#413](https://github.com/walterra/eddoapp/pull/413) [`f11ec8d`](https://github.com/walterra/eddoapp/commit/f11ec8dc1abe575381e2a1f555cee765f2e9bfb3) - Redesign header and toolbar with cleaner layout, popover-based actions, and keyboard shortcut 'n' for adding todos

- [#402](https://github.com/walterra/eddoapp/pull/402) [`a87fdf3`](https://github.com/walterra/eddoapp/commit/a87fdf37368007db60d091278994e7eed3a0223e) - Add inline editing of tags in table view

- [#428](https://github.com/walterra/eddoapp/pull/428) [`a54fbc5`](https://github.com/walterra/eddoapp/commit/a54fbc50ef2b6ce1fbf8800013e01b1e0b6fe261) - Replace metadata JSON editor with user-friendly key/value CRUD interface with namespace suggestions

- [#404](https://github.com/walterra/eddoapp/pull/404) [`6626b55`](https://github.com/walterra/eddoapp/commit/6626b55f92e0fd77e38b7d1592d5871f9861c49c) - Add parent-child todo relationships (subtasks) with UI for viewing and managing hierarchies

### Patch Changes

- [#439](https://github.com/walterra/eddoapp/pull/439) [`dd2c5db`](https://github.com/walterra/eddoapp/commit/dd2c5dbfcec9920a47902b67a95fcd22a82985f6) - Activity sidebar now shows up to 20 items per source filter (web/mcp/github/etc) instead of filtering from a shared pool of 20 items

- [#412](https://github.com/walterra/eddoapp/pull/412) [`a65b4f3`](https://github.com/walterra/eddoapp/commit/a65b4f36528f54bf463893c747a49e374fc4431e) - Limit activity sidebar to show last 20 entries with skeleton loader and footer indicator

- [#420](https://github.com/walterra/eddoapp/pull/420) [`f19c100`](https://github.com/walterra/eddoapp/commit/f19c1002bfcee88ff9bb9998a94373be1c504cfb) - Add clickable todo entries in activity sidebar to open todo flyout

- [#452](https://github.com/walterra/eddoapp/pull/452) [`4723f94`](https://github.com/walterra/eddoapp/commit/4723f942c970d161967b92a4c918578d218c53b8) - Fix render loops causing Chrome "Aw, snap!" crashes in table view

- [#421](https://github.com/walterra/eddoapp/pull/421) [`f1066b2`](https://github.com/walterra/eddoapp/commit/f1066b23b23b2eee7f0537a8126458907ea6b985) - Fix table column order in gear icon popover - columns now always display in canonical order regardless of stored preferences

- [#411](https://github.com/walterra/eddoapp/pull/411) [`260351e`](https://github.com/walterra/eddoapp/commit/260351e5d0e63cec1176b99a292d7fce78ccdb66) - Fix Time Tracked table column to show duration within selected time range instead of only current date

- [#416](https://github.com/walterra/eddoapp/pull/416) [`0db0c12`](https://github.com/walterra/eddoapp/commit/0db0c125187a0c1d84a6a9e6f6a43ed98c5f169c) - Fix time tracking totals to correctly sum visible todo durations including subtask time

- [#434](https://github.com/walterra/eddoapp/pull/434) [`51addeb`](https://github.com/walterra/eddoapp/commit/51addeb3699c8d00ded575d34cd753b78be15cf1) - Fix timezone bug where Day filter showed todos from adjacent days due to +2 hours CEST hack

- [#409](https://github.com/walterra/eddoapp/pull/409) [`dd7bc9d`](https://github.com/walterra/eddoapp/commit/dd7bc9dbbeaf525edba7d6ea1fcfcfe67b5d0489) - Fix invalid HTML nesting error where TodoFlyout div was rendered inside tbody

- [#459](https://github.com/walterra/eddoapp/pull/459) [`1e724c8`](https://github.com/walterra/eddoapp/commit/1e724c8107afbfe9b1bf2c2d0db2b84632c0ae70) - Fix PouchDB performance issues: memory leak, index pre-warming, instant navigation, background prefetch, cascade re-renders

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
