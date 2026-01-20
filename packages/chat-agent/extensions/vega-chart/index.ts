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
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Compute reference path using ESM import.meta.url
const VEGA_REFERENCE_PATH = join(dirname(fileURLToPath(import.meta.url)), 'vega-lite-reference.md');

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'vega_chart',
    label: 'Vega-Lite Chart',
    description: `Render a Vega-Lite specification as a PNG image.

Dependencies are auto-installed via uv (Python package manager):
- uv itself is auto-installed if missing
- Python 3, altair, pandas, vl-convert-python are managed by uv
If setup fails, the tool returns installation instructions - do NOT fall back to ASCII charts.

IMPORTANT: Before using this tool, read the complete reference documentation at:
${VEGA_REFERENCE_PATH}

The reference contains critical information about:
- Data types (N, O, Q, T) and encoding channels
- All mark types and their properties
- Common pitfalls (dot-notation fields, label truncation, facet issues)
- Professional chart patterns with complete working examples
- Theming and best practices

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
        // Check Python and dependencies, auto-install if needed using uv
        const ensureDependencies = (): { success: boolean; error?: string } => {
          // Check if uv is available
          let hasUv = false;
          try {
            execSync('which uv', { encoding: 'utf-8' });
            hasUv = true;
          } catch {
            // uv not available, try to install it
            const platform = process.platform;
            try {
              if (platform === 'win32') {
                execSync('powershell -c "irm https://astral.sh/uv/install.ps1 | iex"', {
                  encoding: 'utf-8',
                  stdio: 'inherit',
                });
              } else {
                execSync('curl -LsSf https://astral.sh/uv/install.sh | sh', {
                  encoding: 'utf-8',
                  stdio: 'inherit',
                });
              }
              // Source the updated PATH or check common install locations
              const uvPaths = [
                `${process.env.HOME}/.local/bin/uv`,
                `${process.env.HOME}/.cargo/bin/uv`,
                '/usr/local/bin/uv',
              ];
              hasUv = uvPaths.some((p) => {
                try {
                  execSync(`${p} --version`, { encoding: 'utf-8' });
                  return true;
                } catch {
                  return false;
                }
              });
            } catch {
              // uv install failed
            }
          }

          if (!hasUv) {
            return {
              success: false,
              error:
                'uv (Python package manager) not found and auto-install failed.\nPlease install uv: curl -LsSf https://astral.sh/uv/install.sh | sh',
            };
          }

          // Use uv to run Python with the required packages
          // uv will auto-install Python and packages as needed
          const checkCmd =
            'uv run --with altair --with pandas --with vl-convert-python python3 -c "import altair; import pandas; import vl_convert"';
          try {
            execSync(checkCmd, { encoding: 'utf-8', stdio: 'pipe' });
            return { success: true };
          } catch (err: any) {
            return {
              success: false,
              error: `Failed to setup Python environment with uv.\nPlease run manually: uv run --with altair --with pandas --with vl-convert-python python3\n\nError: ${err.message}`,
            };
          }
        };

        const deps = ensureDependencies();
        if (!deps.success) {
          return {
            content: [{ type: 'text', text: deps.error! }],
            details: { error: 'Dependencies not installed' },
            isError: true,
          };
        }

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
          `uv run --with altair --with pandas --with vl-convert-python python3 -c "${pythonScript.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`,
          {
            encoding: 'utf-8',
            timeout: 60000, // Longer timeout for first run when uv downloads packages
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
