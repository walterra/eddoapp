# Changelog

## 0.4.0

### Minor Changes

- [#305](https://github.com/walterra/eddoapp/pull/305) [`b77b038`](https://github.com/walterra/eddoapp/commit/b77b038e8acb2ae6a246a77263ddaaa9af72e3b7) - Add automated backup scheduler with retention policy management

- [#304](https://github.com/walterra/eddoapp/pull/304) [`f74f577`](https://github.com/walterra/eddoapp/commit/f74f5777cb25ae769acc363933956823a4b5c76e) - Add real-time user preferences sync across browser tabs via Server-Sent Events (SSE)

### Patch Changes

- [#297](https://github.com/walterra/eddoapp/pull/297) [`a0f5216`](https://github.com/walterra/eddoapp/commit/a0f52162ba5f1505b3873ae4a3e1666e51208a7e) - Fix PR reviews not marked complete when merged by adding `reviewed-by:@me` query to GitHub sync

- [#302](https://github.com/walterra/eddoapp/pull/302) [`5d95862`](https://github.com/walterra/eddoapp/commit/5d9586232163907d2490c0c3207e2783fdb97bfd) - Remove unused exports and dead code identified by knip analysis

- [#300](https://github.com/walterra/eddoapp/pull/300) [`119b61e`](https://github.com/walterra/eddoapp/commit/119b61e990a8de447abf5757cfc1dd20d0a3b476) - Fix MCP server missing database indexes (externalId-index, tags-index)

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
