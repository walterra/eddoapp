/**
 * Graphviz Chart Extension
 *
 * Renders Graphviz DOT specifications as PNG or SVG images in terminals that support
 * inline images (Ghostty, Kitty, iTerm2, WezTerm).
 *
 * Use cases:
 * - Architecture diagrams
 * - Flowcharts
 * - State machines
 * - Dependency graphs
 * - ER diagrams
 * - Network topologies
 */

import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Type } from '@sinclair/typebox';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Compute reference path using ESM import.meta.url
const GRAPHVIZ_REFERENCE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  'graphviz-reference.md',
);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: 'graphviz_chart',
    label: 'Graphviz Chart',
    description: `Render a Graphviz DOT specification as a PNG image.

Graphviz will be auto-installed if not present (via brew on macOS, apt/dnf on Linux).
If auto-install fails, the tool returns installation instructions - do NOT fall back to ASCII art.

IMPORTANT: Before using this tool, read the complete reference documentation at:
${GRAPHVIZ_REFERENCE_PATH}

The reference contains critical information about:
- DOT language syntax for graphs, nodes, and edges
- All node shapes (box, cylinder, diamond, ellipse, etc.)
- Edge styles and arrow types
- Clusters and subgraphs
- Layout engines (dot, neato, fdp, circo, twopi)
- Professional theming (light/dark themes, SaaS aesthetics)
- Common patterns (flowcharts, architecture diagrams, state machines)

Pass a complete DOT graph definition. Supports:
- Graph types: graph (undirected), digraph (directed), strict
- Node shapes: box, ellipse, circle, diamond, cylinder, record, etc.
- Edge styles: solid, dashed, dotted, bold
- Arrows: normal, dot, diamond, box, vee, none, etc.
- Clusters: subgraph cluster_name { ... }
- Attributes: color, fillcolor, style, label, fontname, etc.
- Layout engines: dot (default), neato, fdp, circo, twopi

Example DOT syntax:
\`\`\`
digraph G {
    rankdir=LR;
    node [shape=box style="rounded,filled" fillcolor=lightblue];
    
    A [label="Start"];
    B [label="Process"];
    C [label="End" fillcolor=lightgreen];
    
    A -> B [label="step 1"];
    B -> C [label="step 2"];
}
\`\`\`

Reference: https://graphviz.org/doc/info/lang.html`,
    parameters: Type.Object({
      dot: Type.String({
        description: 'Graphviz DOT specification (complete graph definition)',
      }),
      engine: Type.Optional(
        Type.String({
          description:
            'Layout engine: dot (hierarchical, default), neato (spring), fdp (force-directed), circo (circular), twopi (radial)',
        }),
      ),
      width: Type.Optional(
        Type.Number({
          description: 'Output width in pixels (default: auto based on graph)',
        }),
      ),
      height: Type.Optional(
        Type.Number({
          description: 'Output height in pixels (default: auto based on graph)',
        }),
      ),
      save_path: Type.Optional(
        Type.String({
          description:
            'Optional file path to save the chart. Format determined by extension: .svg for SVG, .png for PNG (default)',
        }),
      ),
    }),

    async execute(_toolCallId, params, _onUpdate, _ctx, signal) {
      const {
        dot,
        engine = 'dot',
        width,
        height,
        save_path,
      } = params as {
        dot: string;
        engine?: string;
        width?: number;
        height?: number;
        save_path?: string;
      };

      if (signal?.aborted) {
        return { content: [{ type: 'text', text: 'Cancelled' }], details: {} };
      }

      // Validate engine
      const validEngines = ['dot', 'neato', 'fdp', 'sfdp', 'circo', 'twopi', 'osage', 'patchwork'];
      if (!validEngines.includes(engine)) {
        return {
          content: [
            {
              type: 'text',
              text: `Invalid engine "${engine}". Valid engines: ${validEngines.join(', ')}`,
            },
          ],
          details: { error: 'Invalid engine' },
          isError: true,
        };
      }

      // Determine output format from save_path extension
      const isSvgOutput = save_path?.toLowerCase().endsWith('.svg') ?? false;
      const outputFormat = isSvgOutput ? 'svg' : 'png';

      try {
        // Check if graphviz is installed, auto-install if not
        try {
          execSync('which dot', { encoding: 'utf-8' });
        } catch {
          // Try to auto-install graphviz
          const platform = process.platform;
          let installCmd: string | null = null;

          if (platform === 'darwin') {
            // macOS - check if brew is available
            try {
              execSync('which brew', { encoding: 'utf-8' });
              installCmd = 'brew install graphviz';
            } catch {
              // brew not available
            }
          } else if (platform === 'linux') {
            // Linux - try apt first, then dnf
            try {
              execSync('which apt', { encoding: 'utf-8' });
              installCmd = 'sudo apt install -y graphviz';
            } catch {
              try {
                execSync('which dnf', { encoding: 'utf-8' });
                installCmd = 'sudo dnf install -y graphviz';
              } catch {
                // no supported package manager
              }
            }
          }

          if (installCmd) {
            try {
              execSync(installCmd, { encoding: 'utf-8', stdio: 'inherit' });
              // Verify installation succeeded
              execSync('which dot', { encoding: 'utf-8' });
            } catch {
              return {
                content: [
                  {
                    type: 'text',
                    text: `Failed to auto-install Graphviz. Please install manually:\n- macOS: brew install graphviz\n- Ubuntu/Debian: sudo apt install graphviz\n- Fedora/RHEL: sudo dnf install graphviz`,
                  },
                ],
                details: { error: 'Graphviz installation failed' },
                isError: true,
              };
            }
          } else {
            return {
              content: [
                {
                  type: 'text',
                  text: `Graphviz not found and auto-install not supported on this platform. Please install manually:\n- macOS: brew install graphviz\n- Ubuntu/Debian: sudo apt install graphviz\n- Fedora/RHEL: sudo dnf install graphviz\n- Windows: https://graphviz.org/download/`,
                },
              ],
              details: { error: 'Graphviz not installed' },
              isError: true,
            };
          }
        }

        const tmpDot = join(tmpdir(), `graphviz-${Date.now()}.dot`);
        const tmpOutput = join(tmpdir(), `graphviz-${Date.now()}.${outputFormat}`);
        // Always generate PNG for terminal display
        const tmpPng = isSvgOutput
          ? join(tmpdir(), `graphviz-${Date.now()}-display.png`)
          : tmpOutput;

        // Write DOT file
        writeFileSync(tmpDot, dot);

        // Build graphviz command for the requested output format
        let cmd = `${engine} -T${outputFormat}`;

        // Add size constraints if specified (applies to both formats)
        if (width || height) {
          // Graphviz uses inches, convert from pixels (assuming 96 DPI)
          const dpi = 96;
          if (width && height) {
            cmd += ` -Gsize="${width / dpi},${height / dpi}!"`;
          } else if (width) {
            cmd += ` -Gsize="${width / dpi},1000!" -Gratio=compress`;
          } else if (height) {
            cmd += ` -Gsize="1000,${height / dpi}!" -Gratio=compress`;
          }
          if (outputFormat === 'png') {
            cmd += ` -Gdpi=${dpi}`;
          }
        } else if (outputFormat === 'png') {
          // Default: higher DPI for better quality (PNG only)
          cmd += ` -Gdpi=150`;
        }

        cmd += ` "${tmpDot}" -o "${tmpOutput}"`;

        // Execute graphviz for main output
        try {
          execSync(cmd, {
            encoding: 'utf-8',
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024,
          });
        } catch (execError: any) {
          const errorMsg = execError.stderr || execError.message;
          // Clean up
          try {
            unlinkSync(tmpDot);
          } catch {}
          return {
            content: [{ type: 'text', text: `Graphviz error: ${errorMsg}` }],
            details: { error: errorMsg },
            isError: true,
          };
        }

        // Check if output was created
        if (!existsSync(tmpOutput)) {
          try {
            unlinkSync(tmpDot);
          } catch {}
          return {
            content: [
              { type: 'text', text: 'Graphviz produced no output. Check your DOT syntax.' },
            ],
            details: { error: 'No output' },
            isError: true,
          };
        }

        // If SVG output, also generate PNG for terminal display
        if (isSvgOutput) {
          let pngCmd = `${engine} -Tpng`;
          if (width || height) {
            const dpi = 96;
            if (width && height) {
              pngCmd += ` -Gsize="${width / dpi},${height / dpi}!"`;
            } else if (width) {
              pngCmd += ` -Gsize="${width / dpi},1000!" -Gratio=compress`;
            } else if (height) {
              pngCmd += ` -Gsize="1000,${height / dpi}!" -Gratio=compress`;
            }
            pngCmd += ` -Gdpi=${dpi}`;
          } else {
            pngCmd += ` -Gdpi=150`;
          }
          pngCmd += ` "${tmpDot}" -o "${tmpPng}"`;

          try {
            execSync(pngCmd, {
              encoding: 'utf-8',
              timeout: 30000,
              maxBuffer: 10 * 1024 * 1024,
            });
          } catch {
            // If PNG generation fails, we can still save SVG but won't display
          }
        }

        // Read the PNG file as base64 for terminal display
        let base64Data: string | undefined;
        if (existsSync(tmpPng)) {
          const pngBuffer = readFileSync(tmpPng);
          base64Data = pngBuffer.toString('base64');
        }

        // If save_path provided, copy the output to that location
        let savedPath: string | undefined;
        if (save_path) {
          try {
            // Ensure directory exists
            mkdirSync(dirname(save_path), { recursive: true });
            const outputBuffer = readFileSync(tmpOutput);
            writeFileSync(save_path, outputBuffer);
            savedPath = save_path;
          } catch (saveErr: any) {
            // Don't fail the whole operation, just note the error
            console.error(`Failed to save to ${save_path}: ${saveErr.message}`);
          }
        }

        // Clean up temp files
        try {
          unlinkSync(tmpDot);
        } catch {}
        try {
          unlinkSync(tmpOutput);
        } catch {}
        if (isSvgOutput && tmpPng !== tmpOutput) {
          try {
            unlinkSync(tmpPng);
          } catch {}
        }

        // Count nodes and edges (rough estimate)
        const nodeCount =
          (dot.match(/\w+\s*\[/g) || []).length + (dot.match(/^\s*\w+\s*;/gm) || []).length;
        const edgeCount = (dot.match(/->/g) || []).length + (dot.match(/--/g) || []).length;

        const formatInfo = isSvgOutput ? ` as ${outputFormat.toUpperCase()}` : '';
        const textMsg = savedPath
          ? `Rendered Graphviz chart (${engine} engine, ~${nodeCount} nodes, ~${edgeCount} edges) - saved${formatInfo} to ${savedPath}`
          : `Rendered Graphviz chart (${engine} engine, ~${nodeCount} nodes, ~${edgeCount} edges)`;

        const content: Array<{ type: string; text?: string; data?: string; mimeType?: string }> =
          [];

        // Add image for terminal display if available
        if (base64Data) {
          content.push({ type: 'image', data: base64Data, mimeType: 'image/png' });
        }
        content.push({ type: 'text', text: textMsg });

        return {
          content,
          details: { engine, nodeCount, edgeCount, savedPath, format: outputFormat },
        };
      } catch (error: any) {
        return {
          content: [{ type: 'text', text: `Error rendering chart: ${error.message}` }],
          details: { error: error.message },
          isError: true,
        };
      }
    },
  });
}
