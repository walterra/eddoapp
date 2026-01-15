# Eddo Chat Agent

This environment has custom extensions for data visualization and architecture diagrams.

## Available Visualization Extensions

### vega_chart - Data Visualization

Use the `vega_chart` tool to render Vega-Lite specifications as PNG images.

**Before using this tool**, read the complete reference documentation:
`/home/agent/.pi/agent/extensions/vega-chart/vega-lite-reference.md`

The reference contains:

- Data types (N, O, Q, T) and encoding channels
- All mark types (bar, line, point, area, rect, etc.)
- Critical pitfalls (dot-notation fields break charts, label truncation, facet issues)
- Professional chart patterns with complete working examples
- Theming (light/dark) and best practices

### graphviz_chart - Architecture Diagrams

Use the `graphviz_chart` tool to render Graphviz DOT specifications as PNG images.

**Before using this tool**, read the complete reference documentation:
`/home/agent/.pi/agent/extensions/graphviz-chart/graphviz-reference.md`

The reference contains:

- DOT language syntax for graphs, nodes, and edges
- All node shapes (box, cylinder, diamond, ellipse, etc.)
- Edge styles and arrow types
- Clusters and subgraphs for grouping
- Layout engines (dot, neato, fdp, circo, twopi)
- Professional theming (light/dark themes, SaaS aesthetics)
- Common patterns (flowcharts, architecture diagrams, state machines, ER diagrams)

## Workflow for Visualizations

1. **Always read the reference first** - The references contain critical information about pitfalls and best practices
2. **Use inline data with simple field names** - Avoid dot-notation in field names (e.g., use `room` not `room.name`)
3. **Follow the chart patterns** - The references include complete working examples
4. **Apply professional theming** - Use the light/dark theme palettes for consistent styling
