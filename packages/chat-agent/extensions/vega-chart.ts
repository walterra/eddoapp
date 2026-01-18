/**
 * Vega-Lite Chart Extension
 *
 * Renders Vega-Lite specifications as PNG images in terminals that support
 * inline images (Ghostty, Kitty, iTerm2, WezTerm).
 *
 * Philosophy (inspired by Bostock & Heer):
 * - Declarative: The agent constructs a Vega-Lite JSON spec
 * - Composable: Full control over marks, encodings, scales, layers
 * - Data-driven: Inline data or separate TSV input
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { execSync } from 'node:child_process';
import { readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'vega_chart',
    label: 'Vega-Lite Chart',
    description: `Render a Vega-Lite specification as a PNG image.

Pass a complete Vega-Lite JSON spec. The agent has full control over:
- Mark types: bar, line, point, area, rect, arc, rule, text, boxplot, etc.
- Encodings: x, y, color, size, shape, opacity, row, column, etc.
- Scales: linear, log, sqrt, pow, time, utc, ordinal, band, point
- Aggregations: count, sum, mean, median, min, max, distinct, etc.
- Transforms: filter, calculate, aggregate, fold, pivot, window, etc.
- Composition: layer, hconcat, vconcat, facet, repeat

Data can be inline in the spec (values) or passed separately as TSV.

Example spec structure:
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": { "values": [...] },
  "mark": "bar",
  "encoding": {
    "x": { "field": "category", "type": "nominal" },
    "y": { "field": "value", "type": "quantitative" }
  }
}

Reference: https://vega.github.io/vega-lite/docs/`,
    parameters: Type.Object({
      spec: Type.String({
        description:
          'Vega-Lite JSON specification (complete spec with $schema, data, mark, encoding)',
      }),
      tsv_data: Type.Optional(
        Type.String({
          description: 'Optional TSV data - if provided, replaces spec.data.values',
        }),
      ),
      width: Type.Optional(Type.Number({ description: 'Chart width in pixels (default: 600)' })),
      height: Type.Optional(Type.Number({ description: 'Chart height in pixels (default: 400)' })),
      save_path: Type.Optional(
        Type.String({
          description: 'Optional file path to save the PNG chart (in addition to displaying it)',
        }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const {
        spec,
        tsv_data,
        width = 600,
        height = 400,
        save_path,
      } = params as {
        spec: string;
        tsv_data?: string;
        width?: number;
        height?: number;
        save_path?: string;
      };

      if (signal?.aborted) {
        return { content: [{ type: 'text', text: 'Cancelled' }], details: {} };
      }

      try {
        // Parse and validate the spec
        let vegaSpec: any;
        try {
          vegaSpec = JSON.parse(spec);
        } catch (e) {
          return {
            content: [{ type: 'text', text: `Invalid JSON in spec: ${e}` }],
            details: { error: 'Invalid JSON' },
            isError: true,
          };
        }

        // Add schema if missing
        if (!vegaSpec.$schema) {
          vegaSpec.$schema = 'https://vega.github.io/schema/vega-lite/v5.json';
        }

        // Set dimensions if not specified
        if (!vegaSpec.width) vegaSpec.width = width;
        if (!vegaSpec.height) vegaSpec.height = height;

        const tmpSpec = join(tmpdir(), `vega-spec-${Date.now()}.json`);
        const tmpTsv = join(tmpdir(), `vega-data-${Date.now()}.tsv`);
        const tmpPng = join(tmpdir(), `vega-chart-${Date.now()}.png`);

        // If TSV data provided, we'll load it in Python
        if (tsv_data) {
          writeFileSync(tmpTsv, tsv_data);
        }

        writeFileSync(tmpSpec, JSON.stringify(vegaSpec, null, 2));

        // Python script to render with Altair
        const pythonScript = `
import altair as alt
import pandas as pd
import json

# Load the Vega-Lite spec
with open('${tmpSpec}', 'r') as f:
    spec = json.load(f)

# If TSV data provided, load it and inject into spec
tsv_path = ${tsv_data ? `'${tmpTsv}'` : 'None'}
if tsv_path:
    df = pd.read_csv(tsv_path, sep='\\t')
    # Convert DataFrame to list of dicts for Vega-Lite
    spec['data'] = {'values': df.to_dict(orient='records')}

# Create chart from spec
chart = alt.Chart.from_dict(spec)

# Save as PNG with retina scale
chart.save('${tmpPng}', scale_factor=2)
print('OK')
`;

        const result = execSync(
          `python3 -c "${pythonScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
          {
            encoding: 'utf-8',
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024,
          },
        );

        if (!result.includes('OK')) {
          throw new Error('Chart generation failed');
        }

        // Read the PNG file as base64
        const pngBuffer = readFileSync(tmpPng);
        const base64Data = pngBuffer.toString('base64');

        // If save_path provided, copy the PNG to that location
        let savedPath: string | undefined;
        if (save_path) {
          const { copyFileSync, mkdirSync } = await import('node:fs');
          const { dirname } = await import('node:path');
          try {
            // Ensure directory exists
            mkdirSync(dirname(save_path), { recursive: true });
            copyFileSync(tmpPng, save_path);
            savedPath = save_path;
          } catch (saveErr: any) {
            // Don't fail the whole operation, just note the error
            console.error(`Failed to save to ${save_path}: ${saveErr.message}`);
          }
        }

        // Clean up temp files
        try {
          unlinkSync(tmpSpec);
        } catch {}
        try {
          unlinkSync(tmpTsv);
        } catch {}
        try {
          unlinkSync(tmpPng);
        } catch {}

        const dataPoints = tsv_data
          ? tsv_data.trim().split('\n').length - 1
          : vegaSpec.data?.values?.length || 0;

        const textMsg = savedPath
          ? `Rendered Vega-Lite chart (${dataPoints} data points) - saved to ${savedPath}`
          : `Rendered Vega-Lite chart (${dataPoints} data points)`;

        return {
          content: [
            { type: 'image', data: base64Data, mimeType: 'image/png' },
            { type: 'text', text: textMsg },
          ],
          details: { dataPoints, width: vegaSpec.width, height: vegaSpec.height, savedPath },
        };
      } catch (error: any) {
        // Try to extract Python error details
        const errorMsg = error.stderr || error.message;
        return {
          content: [{ type: 'text', text: `Error rendering chart: ${errorMsg}` }],
          details: { error: errorMsg },
          isError: true,
        };
      }
    },
  });
}
