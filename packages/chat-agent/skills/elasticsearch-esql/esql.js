#!/usr/bin/env node

/**
 * ES|QL Generator and Executor
 *
 * Generate ES|QL queries from natural language and execute against Elasticsearch.
 *
 * Usage:
 *   ./esql.js generate "natural language query"  - Generate ES|QL only
 *   ./esql.js query "natural language query"     - Generate and execute
 *   ./esql.js raw "ES|QL query"                  - Execute raw ES|QL
 *   ./esql.js chart "ES|QL query"                - Execute and display as ASCII chart
 *   ./esql.js indices [pattern]                  - List indices
 *   ./esql.js schema <index>                     - Get index mappings
 */

import { Client } from '@elastic/elasticsearch';
import asciichart from 'asciichart';

// =============================================================================
// Elasticsearch Client Setup
// =============================================================================

function createClient() {
  const cloudId = process.env.ELASTICSEARCH_CLOUD_ID;
  const apiKey = process.env.ELASTICSEARCH_API_KEY;
  const url = process.env.ELASTICSEARCH_URL;
  const username = process.env.ELASTICSEARCH_USERNAME;
  const password = process.env.ELASTICSEARCH_PASSWORD;
  const insecure = process.env.ELASTICSEARCH_INSECURE === 'true';

  const config = {};

  // Cloud ID takes precedence
  if (cloudId) {
    config.cloud = { id: cloudId };
  } else if (url) {
    config.node = url;
  } else {
    console.error('Error: No Elasticsearch connection configured.');
    console.error('Set ELASTICSEARCH_CLOUD_ID or ELASTICSEARCH_URL environment variable.');
    process.exit(1);
  }

  // Authentication
  if (apiKey) {
    config.auth = { apiKey };
  } else if (username && password) {
    config.auth = { username, password };
  }

  // TLS settings
  if (insecure) {
    config.tls = { rejectUnauthorized: false };
  }

  return new Client(config);
}

// =============================================================================
// ES|QL Execution
// =============================================================================

async function executeEsql(client, query, format = 'json') {
  try {
    const response = await client.esql.query({
      query,
      format,
    });
    return { success: true, data: response };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      query,
      details: error.meta?.body?.error || error,
    };
  }
}

// =============================================================================
// Cluster Info
// =============================================================================

async function getClusterInfo(client) {
  try {
    const info = await client.info();
    return {
      success: true,
      cluster: info.cluster_name,
      version: info.version.number,
      lucene: info.version.lucene_version,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function formatClusterHeader(info) {
  if (!info.success) return '';
  return `[Elasticsearch ${info.version} | Cluster: ${info.cluster}]`;
}

// =============================================================================
// Index Operations
// =============================================================================

async function listIndices(client, pattern = '*') {
  try {
    const response = await client.cat.indices({
      index: pattern,
      format: 'json',
      h: 'index,docs.count,store.size,health,status',
      s: 'index',
    });
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function getSchema(client, index) {
  try {
    const response = await client.indices.getMapping({ index });
    return { success: true, data: response };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// =============================================================================
// Schema Extraction Helper
// =============================================================================

function flattenMappings(mappings, prefix = '') {
  const fields = [];

  function traverse(obj, path) {
    if (!obj || typeof obj !== 'object') return;

    for (const [key, value] of Object.entries(obj)) {
      const fieldPath = path ? `${path}.${key}` : key;

      if (value.type) {
        fields.push({
          field: fieldPath,
          type: value.type,
          ...(value.fields && { subfields: Object.keys(value.fields) }),
        });
      }

      if (value.properties) {
        traverse(value.properties, fieldPath);
      }

      if (value.fields) {
        for (const [subKey, subValue] of Object.entries(value.fields)) {
          if (subValue.type) {
            fields.push({
              field: `${fieldPath}.${subKey}`,
              type: subValue.type,
            });
          }
        }
      }
    }
  }

  traverse(mappings, prefix);
  return fields;
}

// =============================================================================
// Output Formatting
// =============================================================================

function formatEsqlResults(response) {
  if (!response.columns || !response.values) {
    return JSON.stringify(response, null, 2);
  }

  const columns = response.columns.map((c) => c.name);
  const rows = response.values;

  if (rows.length === 0) {
    return 'No results found.';
  }

  // Calculate column widths
  const widths = columns.map((col, i) => {
    const values = rows.map((row) => String(row[i] ?? 'null'));
    return Math.max(col.length, ...values.map((v) => v.length));
  });

  // Format header
  const header = columns.map((col, i) => col.padEnd(widths[i])).join(' | ');
  const separator = widths.map((w) => '-'.repeat(w)).join('-+-');

  // Format rows
  const formattedRows = rows.map((row) =>
    row.map((val, i) => String(val ?? 'null').padEnd(widths[i])).join(' | '),
  );

  return [header, separator, ...formattedRows].join('\n');
}

// =============================================================================
// ASCII Chart Formatting
// =============================================================================

function formatAsChart(response, options = {}) {
  if (!response.columns || !response.values || response.values.length === 0) {
    return 'No data to chart.';
  }

  const columns = response.columns;
  const rows = response.values;

  // Find numeric columns (for Y-axis values)
  const numericColIndices = columns
    .map((col, i) => ({ index: i, name: col.name, type: col.type }))
    .filter((col) =>
      [
        'long',
        'integer',
        'double',
        'float',
        'short',
        'byte',
        'half_float',
        'scaled_float',
      ].includes(col.type),
    );

  // Find label column (for X-axis labels) - prefer date/time, then first non-numeric
  const dateColIndex = columns.findIndex((col) =>
    ['date', 'datetime', 'date_nanos'].includes(col.type),
  );
  const stringColIndex = columns.findIndex((col) => ['keyword', 'text'].includes(col.type));
  const labelColIndex = dateColIndex >= 0 ? dateColIndex : stringColIndex;

  if (numericColIndices.length === 0) {
    return 'No numeric columns found for charting. Need at least one numeric column.';
  }

  // Extract series data
  const series = numericColIndices.map((col) => ({
    name: col.name,
    values: rows.map((row) => {
      const val = row[col.index];
      return val === null || val === undefined ? 0 : Number(val);
    }),
  }));

  // Extract labels if available
  const labels =
    labelColIndex >= 0
      ? rows.map((row) => {
          const val = row[labelColIndex];
          if (val === null) return 'null';
          // Format dates nicely
          if (typeof val === 'string' && val.includes('T')) {
            const date = new Date(val);
            return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
          }
          return String(val).substring(0, 15);
        })
      : null;

  // Chart configuration
  const chartHeight = options.height || 15;
  const chartColors = [
    asciichart.blue,
    asciichart.green,
    asciichart.yellow,
    asciichart.red,
    asciichart.cyan,
    asciichart.magenta,
  ];

  // Build output
  const output = [];

  // Title
  if (options.title) {
    output.push(`\n  ${options.title}\n`);
  }

  // Legend
  if (series.length > 1 || series[0].name) {
    const legend = series
      .map((s, i) => `${chartColors[i % chartColors.length]}■\x1b[0m ${s.name}`)
      .join('  ');
    output.push(`  ${legend}\n`);
  }

  // Plot chart
  try {
    const plotData = series.length === 1 ? series[0].values : series.map((s) => s.values);
    const chartConfig = {
      height: chartHeight,
      colors: series.map((_, i) => chartColors[i % chartColors.length]),
      format: (x) => {
        if (Math.abs(x) >= 1000000) return (x / 1000000).toFixed(1) + 'M';
        if (Math.abs(x) >= 1000) return (x / 1000).toFixed(1) + 'K';
        return x.toFixed(x % 1 === 0 ? 0 : 1).padStart(8);
      },
    };

    output.push(asciichart.plot(plotData, chartConfig));
  } catch (e) {
    return `Chart error: ${e.message}`;
  }

  // X-axis labels (if available and not too many)
  if (labels && labels.length <= 20) {
    const labelLine = labels
      .map((l, i) => {
        if (i === 0 || i === labels.length - 1 || i === Math.floor(labels.length / 2)) {
          return l;
        }
        return '';
      })
      .join('');

    // Simple label display
    output.push(`\n  X: ${labels[0]} → ${labels[labels.length - 1]}`);
  }

  // Summary stats
  for (const s of series) {
    const min = Math.min(...s.values);
    const max = Math.max(...s.values);
    const avg = s.values.reduce((a, b) => a + b, 0) / s.values.length;
    output.push(`  ${s.name}: min=${min.toFixed(2)}, max=${max.toFixed(2)}, avg=${avg.toFixed(2)}`);
  }

  return output.join('\n');
}

// Detect if query results are suitable for charting
function isChartable(response) {
  if (!response.columns || !response.values || response.values.length < 2) {
    return false;
  }
  // Need at least one numeric column
  return response.columns.some((col) =>
    ['long', 'integer', 'double', 'float', 'short', 'byte', 'half_float', 'scaled_float'].includes(
      col.type,
    ),
  );
}

// =============================================================================
// TSV Output (for charting tools)
// =============================================================================

function formatAsTsv(response, includeHeader = true) {
  if (!response.columns || !response.values) {
    return '';
  }

  const columns = response.columns.map((c) => c.name);
  const rows = response.values;

  if (rows.length === 0) {
    return '';
  }

  const lines = [];

  // Header
  if (includeHeader) {
    lines.push(columns.join('\t'));
  }

  // Data rows
  for (const row of rows) {
    const formattedRow = row.map((val) => {
      if (val === null || val === undefined) return '';
      // Format dates more cleanly for charting
      if (typeof val === 'string' && val.includes('T') && val.includes('Z')) {
        return val.replace('T', ' ').replace('Z', '').split('.')[0];
      }
      return String(val);
    });
    lines.push(formattedRow.join('\t'));
  }

  return lines.join('\n');
}

function formatIndices(indices) {
  if (!indices || indices.length === 0) {
    return 'No indices found.';
  }

  const lines = indices.map((idx) => {
    const health = idx.health || '?';
    const status = idx.status || '?';
    const docs = idx['docs.count'] || '0';
    const size = idx['store.size'] || '?';
    return `${health.padEnd(7)} ${status.padEnd(6)} ${idx.index.padEnd(50)} ${docs.padStart(12)} docs  ${size.padStart(10)}`;
  });

  return [
    'health  status index'.padEnd(65) + '       docs         size',
    '-'.repeat(90),
    ...lines,
  ].join('\n');
}

function formatSchema(mappingResponse, index) {
  const indexData = mappingResponse[index] || Object.values(mappingResponse)[0];
  if (!indexData?.mappings?.properties) {
    return 'No mappings found.';
  }

  const fields = flattenMappings(indexData.mappings.properties);

  if (fields.length === 0) {
    return 'No fields found.';
  }

  const maxFieldLen = Math.max(...fields.map((f) => f.field.length), 5);
  const maxTypeLen = Math.max(...fields.map((f) => f.type.length), 4);

  const header = `${'Field'.padEnd(maxFieldLen)} | ${'Type'.padEnd(maxTypeLen)}`;
  const separator = `${'-'.repeat(maxFieldLen)}-+-${'-'.repeat(maxTypeLen)}`;

  const lines = fields.map((f) => `${f.field.padEnd(maxFieldLen)} | ${f.type.padEnd(maxTypeLen)}`);

  return [header, separator, ...lines].join('\n');
}

// =============================================================================
// Main CLI
// =============================================================================

function parseArgs(args) {
  const flags = {
    tsv: false,
    header: true,
    help: false,
  };
  const positional = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--tsv' || arg === '-t') {
      flags.tsv = true;
    } else if (arg === '--no-header') {
      flags.header = false;
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (!arg.startsWith('-')) {
      positional.push(arg);
    }
  }

  return { flags, positional };
}

async function main() {
  const args = process.argv.slice(2);
  const { flags, positional } = parseArgs(args);
  const command = positional[0];
  const input = positional.slice(1).join(' ');

  if (!command || flags.help) {
    printUsage();
    process.exit(flags.help ? 0 : 1);
  }

  // Handle help
  if (command === 'help' || command === '--help' || command === '-h') {
    printUsage();
    process.exit(0);
  }

  // Handle commands that need client
  const client = createClient();

  try {
    switch (command) {
      case 'generate':
        // Just output the natural language - the LLM will generate the query
        console.log('=== Natural Language Request ===');
        console.log(input);
        console.log('\n=== Instructions ===');
        console.log('Read the ES|QL reference at references/esql-reference.md');
        console.log('Then generate a valid ES|QL query based on the request above.');
        console.log("Use './esql.js schema <index>' to discover available fields.");
        break;

      case 'query':
        // This mode expects the LLM to have generated an ES|QL query
        // For now, output instructions for the LLM workflow
        console.log('=== Natural Language Request ===');
        console.log(input);
        console.log('\n=== Workflow ===');
        console.log("1. Use './esql.js indices' to find available indices");
        console.log("2. Use './esql.js schema <index>' to discover fields");
        console.log('3. Read references/esql-reference.md for ES|QL syntax');
        console.log('4. Generate an ES|QL query');
        console.log('5. Execute with \'./esql.js raw "<your ES|QL query>"\'');
        break;

      case 'raw':
        if (!input) {
          console.error('Error: No ES|QL query provided.');
          console.error('Usage: ./esql.js raw "FROM index | STATS count = COUNT(*)"');
          process.exit(1);
        }

        const result = await executeEsql(client, input);

        if (result.success) {
          if (flags.tsv) {
            // TSV output mode - clean output for charting
            console.log(formatAsTsv(result.data, flags.header));
          } else {
            // Normal verbose output
            console.log('=== ES|QL Query ===');
            console.log(input);
            console.log('\n=== Executing... ===\n');
            console.log('=== Results ===');
            console.log(formatEsqlResults(result.data));

            if (result.data.values) {
              console.log(`\n(${result.data.values.length} rows)`);
            }
          }
        } else {
          console.error('=== Error ===');
          console.error(result.error);
          if (result.details?.reason) {
            console.error('\nDetails:', result.details.reason);
          }
          console.log('\n=== Failed Query ===');
          console.log(result.query);
          process.exit(1);
        }
        break;

      case 'chart':
        if (!input) {
          console.error('Error: No ES|QL query provided.');
          console.error(
            'Usage: ./esql.js chart "FROM index | STATS count = COUNT(*) BY hour = DATE_TRUNC(1 hour, @timestamp)"',
          );
          process.exit(1);
        }
        console.log('=== ES|QL Query ===');
        console.log(input);
        console.log('\n=== Executing... ===');

        const chartResult = await executeEsql(client, input);

        if (chartResult.success) {
          if (isChartable(chartResult.data)) {
            console.log('\n=== Chart ===');
            console.log(formatAsChart(chartResult.data));
          } else {
            console.log('\n=== Results (not chartable - need numeric data with 2+ rows) ===');
            console.log(formatEsqlResults(chartResult.data));
          }

          console.log('\n=== Data Table ===');
          console.log(formatEsqlResults(chartResult.data));

          if (chartResult.data.values) {
            console.log(`\n(${chartResult.data.values.length} rows)`);
          }
        } else {
          console.error('=== Error ===');
          console.error(chartResult.error);
          if (chartResult.details?.reason) {
            console.error('\nDetails:', chartResult.details.reason);
          }
          console.log('\n=== Failed Query ===');
          console.log(chartResult.query);
          process.exit(1);
        }
        break;

      case 'indices':
        const pattern = input || '*';
        const indicesClusterInfo = await getClusterInfo(client);
        console.log(formatClusterHeader(indicesClusterInfo));
        console.log(`=== Indices matching "${pattern}" ===\n`);

        const indicesResult = await listIndices(client, pattern);

        if (indicesResult.success) {
          console.log(formatIndices(indicesResult.data));
        } else {
          console.error('Error:', indicesResult.error);
          process.exit(1);
        }
        break;

      case 'schema':
        if (!input) {
          console.error('Error: No index specified.');
          console.error('Usage: ./esql.js schema <index-name>');
          process.exit(1);
        }

        const schemaClusterInfo = await getClusterInfo(client);
        console.log(formatClusterHeader(schemaClusterInfo));
        console.log(`=== Schema for "${input}" ===\n`);

        const schemaResult = await getSchema(client, input);

        if (schemaResult.success) {
          console.log(formatSchema(schemaResult.data, input));
        } else {
          console.error('Error:', schemaResult.error);
          process.exit(1);
        }
        break;

      case 'test':
        // Test connection and show ES|QL feature availability
        console.log('=== Testing Elasticsearch Connection ===\n');
        try {
          const info = await client.info();
          console.log('✓ Connected successfully!');
          console.log(`  Cluster: ${info.cluster_name}`);
          console.log(`  Version: ${info.version.number}`);
          console.log(`  Lucene:  ${info.version.lucene_version}`);

          // Parse version for feature availability
          const version = info.version.number;
          const [major, minor] = version.split('.').map(Number);

          console.log('\n=== ES|QL Feature Availability ===');

          // Test ES|QL availability
          const testResult = await executeEsql(client, 'ROW message = "ES|QL is working!"');
          if (testResult.success) {
            console.log('✓ ES|QL is available');
          } else {
            console.log('✗ ES|QL not available:', testResult.error);
            break;
          }

          // Version-based feature indicators
          const features = [
            { name: 'ES|QL (GA)', minVersion: [8, 14], status: 'GA' },
            { name: 'Async queries', minVersion: [8, 13], status: 'GA' },
            { name: 'Spatial functions', minVersion: [8, 14], status: 'GA' },
            { name: 'Type casting (::)', minVersion: [8, 15], status: 'GA' },
            {
              name: 'MATCH/QSTR functions',
              minVersion: [8, 17],
              status: major >= 9 ? 'GA' : 'Preview',
            },
            {
              name: 'LOOKUP JOIN',
              minVersion: [8, 18],
              status: major >= 9 && minor >= 1 ? 'GA' : 'Preview',
            },
            { name: 'Scoring (_score)', minVersion: [8, 18], status: 'GA' },
            { name: 'KQL function', minVersion: [8, 18], status: major >= 9 ? 'GA' : 'Preview' },
            { name: 'INLINESTATS', minVersion: [9, 1], status: 'GA' },
            { name: 'Multi-field JOIN', minVersion: [9, 2], status: 'GA' },
            { name: 'Timezone support', minVersion: [9, 3], status: 'GA' },
          ];

          for (const feature of features) {
            const [minMajor, minMinor] = feature.minVersion;
            const available = major > minMajor || (major === minMajor && minor >= minMinor);
            const symbol = available ? '✓' : '✗';
            const status = available ? `(${feature.status})` : '(not available)';
            console.log(`${symbol} ${feature.name} ${status}`);
          }

          console.log('\n=== Limitations ===');
          console.log('• Max result rows: 10,000 (no cursor pagination)');
          if (major < 9 || (major === 9 && minor < 3)) {
            console.log('• Timezone: Not supported in DATE_FORMAT/DATE_PARSE');
          }
          console.log('• Nested fields: Not supported');
        } catch (error) {
          console.error('✗ Connection failed:', error.message);
          process.exit(1);
        }
        break;

      default:
        console.error(`Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } finally {
    await client.close();
  }
}

function printUsage() {
  console.log(`
ES|QL Generator and Executor

Usage:
  ./esql.js <command> [options] [arguments]

Commands:
  generate <request>    Output natural language request for ES|QL generation
  query <request>       Full workflow: discover schema, generate, and execute
  raw <esql>            Execute a raw ES|QL query directly
  chart <esql>          Execute and display results as ASCII chart (built-in)
  indices [pattern]     List indices (optional pattern filter)
  schema <index>        Show field mappings for an index
  test                  Test Elasticsearch connection and ES|QL availability
  help                  Show this help message

Options:
  --tsv, -t             Output as TSV (tab-separated values) for charting
  --no-header           Omit header row in TSV output

Environment Variables:
  ELASTICSEARCH_CLOUD_ID    Elastic Cloud deployment ID
  ELASTICSEARCH_URL         Direct Elasticsearch URL
  ELASTICSEARCH_API_KEY     API key for authentication
  ELASTICSEARCH_USERNAME    Username for basic auth
  ELASTICSEARCH_PASSWORD    Password for basic auth
  ELASTICSEARCH_INSECURE    Set to "true" to skip TLS verification

Examples:
  ./esql.js test
  ./esql.js indices "logs-*"
  ./esql.js schema "logs-2024.01.01"
  ./esql.js raw "FROM logs-* | STATS count = COUNT(*) BY host.name | LIMIT 10"
  ./esql.js chart "FROM logs-* | STATS count = COUNT(*) BY hour = DATE_TRUNC(1 hour, @timestamp) | SORT hour | LIMIT 24"
`);
}

main().catch((error) => {
  console.error('Fatal error:', error.message);
  process.exit(1);
});
