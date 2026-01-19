# ES|QL Version History and Feature Availability

This document tracks ES|QL language features, commands, and functions across Elasticsearch versions. Use this to determine compatibility when writing queries for specific Elasticsearch deployments.

## Version Timeline Overview

| Version | Release  | Status       | Key Additions                         |
| ------- | -------- | ------------ | ------------------------------------- | ---------- |
| 8.11    | Nov 2023 | Tech Preview | Initial ES                            | QL release |
| 8.12    | Jan 2024 | Tech Preview | Spatial types, PROFILE                |
| 8.13    | Mar 2024 | Tech Preview | Async queries, cross-cluster ENRICH   |
| 8.14    | May 2024 | **GA**       | Spatial functions, regex optimization |
| 8.15    | Aug 2024 | GA           | Type casting (`::`), Arrow output     |
| 8.16    | Oct 2024 | GA           | New math/string functions             |
| 8.17    | Dec 2024 | GA           | MATCH, QSTR full-text functions       |
| 8.18    | Feb 2025 | GA           | LOOKUP JOIN (preview), scoring, KQL   |
| 8.19    | Apr 2025 | GA           | MATCH_PHRASE, FORK                    |
| 9.0     | Feb 2025 | GA           | Released with 8.18 features           |
| 9.1     | Jun 2025 | GA           | Full-text functions GA, INLINE STATS  |
| 9.2     | Oct 2025 | GA           | Multi-field joins, TS command, FUSE   |

## Feature Availability by Version

### Commands

| Command        | Introduced | GA       | Notes                                       |
| -------------- | ---------- | -------- | ------------------------------------------- |
| `FROM`         | 8.11       | 8.14     | Source command                              |
| `WHERE`        | 8.11       | 8.14     | Filtering                                   |
| `EVAL`         | 8.11       | 8.14     | Computed columns                            |
| `STATS ... BY` | 8.11       | 8.14     | Aggregations with grouping                  |
| `SORT`         | 8.11       | 8.14     | Ordering results                            |
| `LIMIT`        | 8.11       | 8.14     | Result set size                             |
| `KEEP`         | 8.11       | 8.14     | Column selection                            |
| `DROP`         | 8.11       | 8.14     | Column removal                              |
| `RENAME`       | 8.11       | 8.14     | Column renaming                             |
| `DISSECT`      | 8.11       | 8.14     | Pattern extraction                          |
| `GROK`         | 8.11       | 8.14     | Log parsing                                 |
| `ENRICH`       | 8.11       | 8.14     | Data enrichment                             |
| `MV_EXPAND`    | 8.11       | 8.14     | Multi-value expansion                       |
| `SHOW`         | 8.11       | 8.14     | Metadata display                            |
| `ROW`          | 8.11       | 8.14     | Literal row creation                        |
| `LOOKUP JOIN`  | 8.18       | 8.19/9.1 | SQL-style LEFT JOIN with lookup indices     |
| `INLINESTATS`  | 9.1        | 9.1      | Inline aggregations (like window functions) |
| `FORK`         | 8.19/9.1   | 9.1      | Multiple execution branches                 |
| `FUSE`         | 9.2        | 9.2      | Combine results from FORK branches          |
| `TS`           | 9.2        | 9.2      | Time series mode                            |
| `RERANK`       | 9.2        | 9.2      | Re-score results with inference             |
| `COMPLETION`   | 9.2        | 9.2      | LLM text generation                         |
| `SAMPLE`       | 9.2+       | Preview  | Random sampling                             |

### Full-Text Search Functions

| Function                      | Introduced | GA  | Notes                        |
| ----------------------------- | ---------- | --- | ---------------------------- |
| `MATCH(field, query)`         | 8.17       | 9.1 | Basic full-text matching     |
| `QSTR(query_string)`          | 8.17       | 9.1 | Query string syntax (Lucene) |
| `KQL(kql_string)`             | 8.18/9.0   | 9.1 | Kibana Query Language        |
| `MATCH_PHRASE(field, phrase)` | 8.19/9.1   | 9.1 | Exact phrase matching        |
| Match operator (`:`)          | 8.17       | 9.1 | Shorthand for MATCH          |

**Scoring support:**

- `METADATA _score` available from 8.18/9.0
- Must use `SORT _score DESC` to rank by relevance

### Spatial Functions

| Function               | Introduced | Notes                        |
| ---------------------- | ---------- | ---------------------------- |
| `GEO_POINT` type       | 8.12       | Basic spatial type support   |
| `CARTESIAN_POINT` type | 8.12       | Cartesian coordinate support |
| `ST_INTERSECTS`        | 8.14       | Geometry intersection test   |
| `ST_CONTAINS`          | 8.14       | Containment test             |
| `ST_DISJOINT`          | 8.14       | Disjoint test                |
| `ST_WITHIN`            | 8.14       | Within test                  |
| `ST_X`, `ST_Y`         | 8.14       | Coordinate extraction        |
| `ST_DISTANCE`          | 8.15       | Distance calculation         |
| `ST_EXTENT_AGG`        | 8.18       | Bounding box aggregation     |
| `ST_ENVELOPE`          | 8.18       | Bounding box for geometry    |

### Date/Time Functions

| Function          | Introduced     | Notes                                |
| ----------------- | -------------- | ------------------------------------ |
| `NOW()`           | 8.11           | Current timestamp                    |
| `DATE_TRUNC`      | 8.11           | Truncate to interval                 |
| `DATE_EXTRACT`    | 8.11           | Extract date parts                   |
| `DATE_FORMAT`     | 8.11           | Format dates (no TZ until 9.3)       |
| `DATE_PARSE`      | 8.11           | Parse date strings (no TZ until 9.3) |
| `DATE_DIFF`       | 8.13           | Difference between dates             |
| `date_nanos` type | 8.17 (preview) | Nanosecond precision timestamps      |

### String Functions

| Function                    | Introduced | Notes                       |
| --------------------------- | ---------- | --------------------------- |
| `LEFT`, `RIGHT`             | 8.11       | Substring extraction        |
| `SUBSTRING`                 | 8.11       | Position-based extraction   |
| `CONCAT`                    | 8.11       | String concatenation        |
| `TRIM`, `LTRIM`, `RTRIM`    | 8.11       | Whitespace removal          |
| `TO_UPPER`, `TO_LOWER`      | 8.13       | Case conversion             |
| `LOCATE`                    | 8.14       | Find substring position     |
| `SPACE`                     | 8.16       | Generate spaces             |
| `REVERSE`                   | 8.16       | Reverse string              |
| `BIT_LENGTH`, `BYTE_LENGTH` | 8.17       | String length in bits/bytes |
| `STARTS_WITH`, `ENDS_WITH`  | 8.11       | Prefix/suffix matching      |

### Multi-Value Functions

| Function                  | Introduced | Notes                  |
| ------------------------- | ---------- | ---------------------- |
| `MV_COUNT`                | 8.11       | Count values           |
| `MV_CONCAT`               | 8.11       | Join values            |
| `MV_FIRST`, `MV_LAST`     | 8.13       | First/last value       |
| `MV_MIN`, `MV_MAX`        | 8.11       | Min/max value          |
| `MV_SUM`, `MV_AVG`        | 8.11       | Sum/average            |
| `MV_MEDIAN`               | 8.11       | Median value           |
| `MV_SORT`                 | 8.14       | Sort multi-values      |
| `MV_SLICE`                | 8.14       | Slice multi-values     |
| `MV_PERCENTILE`           | 8.16       | Percentile calculation |
| `MV_PSERIES_WEIGHTED_SUM` | 8.16       | Weighted sum           |

### Aggregation Functions

| Function                              | Introduced | Notes                           |
| ------------------------------------- | ---------- | ------------------------------- |
| `COUNT`, `COUNT_DISTINCT`             | 8.11       | Counting                        |
| `SUM`, `AVG`                          | 8.11       | Basic aggregations              |
| `MIN`, `MAX`                          | 8.11       | Extended to strings/IPs in 8.16 |
| `MEDIAN`, `MEDIAN_ABSOLUTE_DEVIATION` | 8.11       | Statistical                     |
| `PERCENTILE`                          | 8.11       | Percentile calculation          |
| `TOP`                                 | 8.15       | Top N values                    |
| `VALUES`                              | 8.14       | Collect unique values           |
| `CATEGORIZE`                          | 8.18       | Auto-categorization (grouping)  |
| `ST_EXTENT_AGG`                       | 8.18       | Spatial bounding box            |
| `WEIGHTED_AVG`                        | 8.16       | Weighted average                |

### Type Casting

| Syntax          | Introduced | Notes                  |
| --------------- | ---------- | ---------------------- |
| `TO_STRING(x)`  | 8.11       | Function-based casting |
| `TO_INTEGER(x)` | 8.11       | Function-based casting |
| `TO_DOUBLE(x)`  | 8.11       | Function-based casting |
| `x::string`     | 8.15       | Operator-based casting |
| `x::integer`    | 8.15       | Operator-based casting |

## Major Limitations

### Pagination (Not Supported)

ES|QL **does not support cursor-based pagination** like the Search API's `search_after` or `scroll`.

**Current behavior:**

- Default: 1,000 rows returned
- Maximum: 10,000 rows (configurable via `esql.query.result_truncation_max_size`)
- No cursor or continuation token
- GitHub tracking issue: [#100000](https://github.com/elastic/elasticsearch/issues/100000)

**Workarounds:**

- Use `WHERE` to filter to relevant subset
- Use `STATS` to aggregate at query time
- For exports, use Search API with `search_after` instead

### Time Zone Support (Limited)

ES|QL has **limited timezone support** until 9.3.

**Current limitations:**

- `DATE_FORMAT` and `DATE_PARSE` don't support timezone parameters before 9.3
- All dates processed in UTC internally
- Kibana charts may show timezone inconsistencies
- GitHub tracking issue: [#107560](https://github.com/elastic/elasticsearch/issues/107560)

**Workarounds (pre-9.3):**

- Store timezone offset in a separate field
- Convert to UTC before querying
- Use `EVAL` to add/subtract hours manually:
  ```esql
  | EVAL local_time = timestamp + 1 hour
  ```

**9.3+ improvements:**

- `DATE_FORMAT(field, format, timezone)` supported
- `DATE_PARSE(field, format, timezone)` supported

### Nested Fields (Not Supported)

ES|QL **cannot query nested field types**.

- Nested objects return null
- Cannot use nested paths like `nested_field.sub_field`
- Must flatten data at index time for ES|QL access

### Unsupported Field Types

These field types are not supported or have limitations:

| Type           | Status                       |
| -------------- | ---------------------------- |
| `nested`       | Not supported - returns null |
| `flattened`    | Not supported                |
| `join`         | Not supported                |
| `date_range`   | Not supported                |
| `binary`       | Not supported                |
| `completion`   | Not supported                |
| `rank_feature` | Not supported                |
| `histogram`    | Not supported                |

### JOIN Limitations

`LOOKUP JOIN` (8.18+):

- Only LEFT OUTER JOIN behavior
- Lookup index must use `index.mode: lookup` setting
- Lookup index limited to single shard (max 2B docs)
- Cross-cluster joins require lookup index on all clusters
- Only supports equality joins until 9.2

`LOOKUP JOIN` improvements in 9.2:

- Multi-field joins supported
- Complex join predicates with `<`, `>`, `<=`, `>=`
- Massive performance gains for filtered joins

### No Subqueries

ES|QL does not support:

- Subqueries in WHERE clauses
- Nested SELECT statements
- CTEs (Common Table Expressions)

Use `INLINESTATS` (9.1+) for some subquery-like patterns.

## Cross-Cluster Query Support

| Feature                   | Version | Notes                                     |
| ------------------------- | ------- | ----------------------------------------- |
| Basic CCS                 | 8.13    | Query remote clusters                     |
| Cross-cluster ENRICH      | 8.13    | Enrich with remote data                   |
| Cross-cluster LOOKUP JOIN | 9.2     | Join with remote lookup indices           |
| `skip_unavailable`        | 8.17    | Graceful handling of unavailable clusters |

## Output Formats

| Format | Version | Notes                   |
| ------ | ------- | ----------------------- |
| JSON   | 8.11    | Default format          |
| CSV    | 8.11    | Tabular output          |
| TSV    | 8.11    | Tab-separated           |
| Arrow  | 8.15    | Apache Arrow IPC format |

## API Endpoints

| Endpoint                    | Version | Notes                   |
| --------------------------- | ------- | ----------------------- |
| `POST /_query`              | 8.11    | Synchronous query       |
| `POST /_query/async`        | 8.13    | Async query submission  |
| `GET /_query/async/{id}`    | 8.13    | Get async query results |
| `DELETE /_query/async/{id}` | 8.13    | Cancel async query      |

## Performance Tips by Version

### 8.14+

- Regex patterns are optimized
- Enrich supports text fields

### 8.15+

- Use `::` casting instead of `TO_*` functions (cleaner syntax)
- Arrow format for analytics tool integration

### 8.17+

- Use `MATCH`/`QSTR` instead of `LIKE`/`RLIKE` for text search (50-1000x faster)
- Full-text functions use Lucene optimizations

### 9.1+

- Use `INLINESTATS` to avoid multiple queries
- Full-text functions are GA and stable

### 9.2+

- Multi-field `LOOKUP JOIN` for complex correlations
- `FUSE` for hybrid search scoring

## Version Detection

To check ES|QL availability and version:

```bash
# Check Elasticsearch version
curl -s localhost:9200 | jq '.version.number'

# Test ES|QL availability
curl -X POST localhost:9200/_query \
  -H "Content-Type: application/json" \
  -d '{"query": "ROW x = 1"}'
```

## References

- [ES|QL Timeline of Improvements](https://www.elastic.co/search-labs/blog/esql-timeline-of-improvements)
- [ES|QL Limitations](https://www.elastic.co/docs/reference/query-languages/esql/limitations)
- [Elasticsearch Release Notes](https://www.elastic.co/docs/release-notes/elasticsearch)
- [ES|QL for Search](https://www.elastic.co/docs/solutions/search/esql-for-search)
- [LOOKUP JOIN Documentation](https://www.elastic.co/docs/reference/query-languages/esql/esql-lookup-join)
