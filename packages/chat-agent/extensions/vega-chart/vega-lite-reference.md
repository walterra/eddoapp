# Vega-Lite Visualization Reference

A comprehensive reference for creating data visualizations using Vega-Lite specifications. This guide follows best practices from the [UW Interactive Data Lab Visualization Curriculum](https://idl.uw.edu/visualization-curriculum/intro.html) and established visualization research.

## Prerequisites

Dependencies are **auto-installed** via `uv` (Python package manager) when first using this extension:

- `uv` is auto-installed if not present
- Python 3, `altair`, `pandas`, `vl-convert-python` are managed by uv automatically

If auto-install fails, manual installation:

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Run with dependencies (uv handles Python + packages)
uv run --with altair --with pandas --with vl-convert-python python3 your_script.py
```

If dependencies cannot be installed, the tool returns an error with instructions. Do NOT fall back to ASCII charts.

## Philosophy

> "A visualization is a mapping from data to visual properties. The key insight is that this mapping should be **declarative** rather than imperative."

Vega-Lite embodies a **grammar of graphics**: you describe _what_ you want to visualize, not _how_ to draw it. This enables:

- Concise specifications
- Automatic inference of scales, axes, legends
- Composable multi-view displays
- Reproducible visualizations

---

## Critical Pitfalls (Read First!)

> ⚠️ **These issues cause silent failures. Your chart will render but show wrong/missing data.**

### 1. Dot-Notation Field Names

**Problem:** Field names containing dots (e.g., `room.name`, `host.ip`, `metric.value`) are interpreted as nested object paths.

```json
// Data from ES|QL: {"room.name": "Kitchen", "temp": 21}
// Vega-Lite looks for: {room: {name: "Kitchen"}}
// Result: "undefined" in labels, collapsed bars, broken legends
```

**Solution:** Always transform data to use simple field names:

```json
// ❌ BROKEN
{"data": {"values": [{"room.name": "Kitchen"}]}}

// ✅ WORKS
{"data": {"values": [{"room": "Kitchen"}]}}
```

### 2. Horizontal Bar Chart Label Truncation

Y-axis labels get cut off on horizontal bar charts. Always set `labelLimit`:

```json
"y": {"field": "category", "axis": {"labelLimit": 200}}
```

Or use vertical bars with angled labels:

```json
"x": {"field": "category", "axis": {"labelAngle": -45, "labelLimit": 120}}
```

### 3. Facet/Repeat Incompatibility

Top-level `facet` and `repeat` with `spec` fail in Altair v6. Use encoding-based faceting:

```json
// ❌ FAILS
{"facet": {"column": {"field": "region"}}, "spec": {...}}

// ✅ WORKS
{"encoding": {"column": {"field": "region", "type": "nominal"}, ...}}
```

### 4. Aspect Ratio Mistakes

- **Time series too tall:** Makes trends unreadable. Use 3:1 or 4:1 (width:height)
- **Bar charts too short:** Labels get truncated. Give adequate height per category

```json
// Time series: wide
{"width": 600, "height": 200}

// Bar chart with 8 categories: give height
{"width": 450, "height": 300}
```

### 5. Legends vs Direct Labels

Legends force the reader's eye to jump back and forth. Label lines directly:

```json
{
  "layer": [
    { "mark": "line" },
    {
      "mark": { "type": "text", "align": "left", "dx": 5 },
      "transform": [{ "filter": "datum.x == datum.max_x" }],
      "encoding": { "text": { "field": "series" } }
    }
  ]
}
```

---

## Specification Structure

A Vega-Lite specification is a JSON object:

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "data": { ... },
  "mark": "...",
  "encoding": { ... },
  "width": 600,
  "height": 400
}
```

### Core Components

| Component   | Description                                         |
| ----------- | --------------------------------------------------- |
| `data`      | Input data (inline values, URL, or named dataset)   |
| `mark`      | Geometric shape (bar, line, point, area, etc.)      |
| `encoding`  | Mapping of data fields to visual channels           |
| `transform` | Data transformations (filter, aggregate, calculate) |
| `config`    | Styling defaults                                    |

---

## Data Types

Understanding data types is fundamental to choosing appropriate visual encodings.

| Type             | Symbol | Description              | Example                      | Appropriate Channels           |
| ---------------- | ------ | ------------------------ | ---------------------------- | ------------------------------ |
| **Nominal**      | `N`    | Categories without order | country, product type        | color hue, shape, row/column   |
| **Ordinal**      | `O`    | Ordered categories       | rating (low/med/high), month | position, color value, size    |
| **Quantitative** | `Q`    | Continuous numbers       | temperature, revenue         | position, size, color gradient |
| **Temporal**     | `T`    | Date/time values         | timestamp, date              | position (time axis)           |

### Type Selection Guidelines

- **Nominal**: Use when equality comparison matters (A = B?)
- **Ordinal**: Use when rank order matters (A < B?)
- **Quantitative**: Use when magnitude/distance matters (A - B = ?)
- **Temporal**: Use for time-based data with calendar semantics

---

## Encoding Channels

Channels map data fields to visual properties.

### Position Channels

```json
"encoding": {
  "x": {"field": "date", "type": "temporal"},
  "y": {"field": "value", "type": "quantitative"},
  "x2": {"field": "end_date"},
  "y2": {"field": "high_value"}
}
```

| Channel              | Description                 | Best For               |
| -------------------- | --------------------------- | ---------------------- |
| `x`, `y`             | Primary position            | All data types         |
| `x2`, `y2`           | Secondary position (ranges) | Range bars, error bars |
| `xOffset`, `yOffset` | Position offset within band | Grouped/dodged bars    |

### Mark Property Channels

```json
"encoding": {
  "color": {"field": "category", "type": "nominal"},
  "size": {"field": "population", "type": "quantitative"},
  "shape": {"field": "region", "type": "nominal"},
  "opacity": {"field": "confidence", "type": "quantitative"}
}
```

| Channel       | Description        | Best For                               |
| ------------- | ------------------ | -------------------------------------- |
| `color`       | Fill/stroke color  | Nominal (hue), Quantitative (gradient) |
| `size`        | Mark size/area     | Quantitative values                    |
| `shape`       | Point symbol shape | Nominal (≤6 categories)                |
| `opacity`     | Transparency       | Quantitative, overlapping data         |
| `strokeWidth` | Line thickness     | Quantitative                           |
| `strokeDash`  | Dash pattern       | Nominal (≤3 categories)                |

### Text & Tooltip Channels

```json
"encoding": {
  "text": {"field": "label"},
  "tooltip": [
    {"field": "name", "title": "Country"},
    {"field": "value", "title": "GDP", "format": ",.0f"}
  ]
}
```

### Facet Channels

```json
"encoding": {
  "row": {"field": "region", "type": "nominal"},
  "column": {"field": "year", "type": "ordinal"}
}
```

---

## Mark Types

### Basic Marks

| Mark     | Use Case             | Example            |
| -------- | -------------------- | ------------------ |
| `point`  | Scatter plots        | `"mark": "point"`  |
| `circle` | Filled scatter plots | `"mark": "circle"` |
| `square` | Matrix displays      | `"mark": "square"` |
| `bar`    | Bar charts           | `"mark": "bar"`    |
| `line`   | Time series, trends  | `"mark": "line"`   |
| `area`   | Volume over time     | `"mark": "area"`   |
| `tick`   | Strip plots          | `"mark": "tick"`   |
| `rule`   | Reference lines      | `"mark": "rule"`   |
| `text`   | Labels               | `"mark": "text"`   |
| `rect`   | Heatmaps             | `"mark": "rect"`   |
| `arc`    | Pie/donut charts     | `"mark": "arc"`    |

### Composite Marks

| Mark        | Use Case                  |
| ----------- | ------------------------- |
| `boxplot`   | Distribution summary      |
| `errorbar`  | Uncertainty visualization |
| `errorband` | Confidence intervals      |

### Mark Properties

```json
"mark": {
  "type": "bar",
  "color": "#4c78a8",
  "opacity": 0.8,
  "cornerRadius": 2,
  "strokeWidth": 0
}
```

---

## Scales

Scales map data values to visual values.

### Scale Types

| Type      | Description         | Use For                     |
| --------- | ------------------- | --------------------------- |
| `linear`  | Linear mapping      | Quantitative data           |
| `log`     | Logarithmic         | Wide-ranging values, ratios |
| `sqrt`    | Square root         | Area-based size encoding    |
| `pow`     | Power scale         | Custom nonlinear            |
| `time`    | Time-based          | Temporal data               |
| `utc`     | UTC time            | Cross-timezone data         |
| `ordinal` | Discrete categories | Nominal/ordinal             |
| `band`    | Discrete with width | Bar charts                  |
| `point`   | Discrete points     | Dot plots                   |

### Scale Configuration

```json
"encoding": {
  "x": {
    "field": "value",
    "type": "quantitative",
    "scale": {
      "domain": [0, 100],
      "range": [0, 400],
      "zero": true,
      "nice": true,
      "clamp": true
    }
  }
}
```

### Color Scales

```json
"encoding": {
  "color": {
    "field": "temperature",
    "type": "quantitative",
    "scale": {
      "scheme": "viridis",
      "domain": [-10, 40]
    }
  }
}
```

**Recommended Color Schemes:**

| Type        | Schemes                                         |
| ----------- | ----------------------------------------------- |
| Sequential  | `viridis`, `blues`, `greens`, `oranges`, `reds` |
| Diverging   | `redblue`, `redyellowblue`, `spectral`          |
| Categorical | `category10`, `tableau10`, `set1`               |

---

## Transforms

Data transformations within the spec.

### Filter

```json
"transform": [
  {"filter": "datum.year == 2020"},
  {"filter": {"field": "country", "oneOf": ["USA", "China", "India"]}}
]
```

### Calculate

```json
"transform": [
  {"calculate": "datum.revenue - datum.cost", "as": "profit"},
  {"calculate": "datum.value * 100 / datum.total", "as": "percentage"}
]
```

### Aggregate

```json
"transform": [
  {
    "aggregate": [
      {"op": "mean", "field": "temperature", "as": "avg_temp"},
      {"op": "count", "as": "n"}
    ],
    "groupby": ["month", "location"]
  }
]
```

**Aggregation Operations:** `count`, `sum`, `mean`, `median`, `min`, `max`, `stdev`, `variance`, `q1`, `q3`, `distinct`, `values`

### Bin

```json
"encoding": {
  "x": {
    "bin": true,
    "field": "temperature"
  },
  "y": {"aggregate": "count"}
}
```

Or explicit:

```json
"transform": [
  {"bin": {"maxbins": 20}, "field": "value", "as": "value_bin"}
]
```

### Time Unit

```json
"encoding": {
  "x": {
    "timeUnit": "yearmonth",
    "field": "date"
  }
}
```

**Time Units:** `year`, `quarter`, `month`, `week`, `day`, `dayofyear`, `date`, `hours`, `minutes`, `seconds`, `milliseconds`, `yearmonth`, `yearmonthdate`, `monthdate`, `hoursminutes`

### Window

```json
"transform": [
  {
    "window": [
      {"op": "row_number", "as": "rank"},
      {"op": "sum", "field": "value", "as": "cumulative"}
    ],
    "sort": [{"field": "value", "order": "descending"}]
  }
]
```

### Fold (Unpivot)

```json
"transform": [
  {"fold": ["temp_min", "temp_max"], "as": ["measure", "value"]}
]
```

### Pivot

```json
"transform": [
  {"pivot": "category", "value": "amount", "groupby": ["date"]}
]
```

### Regression & Loess

```json
"transform": [
  {"regression": "y", "on": "x", "method": "linear"}
]
```

```json
"transform": [
  {"loess": "y", "on": "x", "bandwidth": 0.3}
]
```

---

## Multi-View Composition

Composition is fundamental to professional data visualization.

### Layer

Superimpose multiple marks on shared axes.

```json
{
  "layer": [
    {
      "mark": "area",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    },
    {
      "mark": { "type": "line", "color": "black" },
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    }
  ]
}
```

**Use Cases:**

- Area with line overlay
- Points with trend line
- Bars with reference rules
- Confidence bands with mean line

### Horizontal Concatenation (hconcat)

```json
{
  "hconcat": [
    {"mark": "bar", "encoding": {...}},
    {"mark": "line", "encoding": {...}}
  ]
}
```

### Vertical Concatenation (vconcat)

```json
{
  "vconcat": [
    {"mark": "bar", "encoding": {...}},
    {"mark": "line", "encoding": {...}}
  ]
}
```

### Facet (Small Multiples)

Partition data into sub-plots.

```json
{
  "facet": {
    "column": { "field": "region", "type": "nominal" },
    "row": { "field": "year", "type": "ordinal" }
  },
  "spec": {
    "mark": "point",
    "encoding": {
      "x": { "field": "x", "type": "quantitative" },
      "y": { "field": "y", "type": "quantitative" }
    }
  }
}
```

Or using encoding channels:

```json
{
  "mark": "bar",
  "encoding": {
    "x": { "field": "value", "type": "quantitative" },
    "y": { "field": "category", "type": "nominal" },
    "column": { "field": "region", "type": "nominal" }
  }
}
```

### Repeat

Generate multiple views from a template.

```json
{
  "repeat": {
    "column": ["temp", "humidity", "pressure"]
  },
  "spec": {
    "mark": "line",
    "encoding": {
      "x": { "field": "date", "type": "temporal" },
      "y": { "field": { "repeat": "column" }, "type": "quantitative" }
    }
  }
}
```

**SPLOM (Scatter Plot Matrix):**

```json
{
  "repeat": {
    "row": ["mpg", "hp", "weight"],
    "column": ["mpg", "hp", "weight"]
  },
  "spec": {
    "mark": "point",
    "encoding": {
      "x": { "field": { "repeat": "column" }, "type": "quantitative" },
      "y": { "field": { "repeat": "row" }, "type": "quantitative" }
    }
  }
}
```

### Resolve

Control how scales/axes/legends are shared or independent.

```json
{
  "layer": [...],
  "resolve": {
    "scale": {"y": "independent"},
    "axis": {"y": "independent"},
    "legend": {"color": "independent"}
  }
}
```

---

## Common Chart Patterns (Complete Working Examples)

> All examples use inline data with simple field names to avoid dot-notation issues.

### Horizontal Bar Chart with Value Labels

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": { "text": "Sales by Region", "anchor": "start" },
  "width": 400,
  "height": 200,
  "data": {
    "values": [
      { "region": "North America", "sales": 65000 },
      { "region": "Europe", "sales": 48000 },
      { "region": "Asia Pacific", "sales": 35000 },
      { "region": "Latin America", "sales": 12000 }
    ]
  },
  "layer": [
    { "mark": { "type": "bar", "cornerRadiusEnd": 3 } },
    {
      "mark": { "type": "text", "align": "left", "dx": 5, "fontSize": 11 },
      "encoding": { "text": { "field": "sales", "format": "," } }
    }
  ],
  "encoding": {
    "y": {
      "field": "region",
      "type": "nominal",
      "sort": "-x",
      "title": null,
      "axis": { "labelLimit": 150 }
    },
    "x": { "field": "sales", "type": "quantitative", "title": "Sales ($)" },
    "color": { "value": "#4c78a8" }
  },
  "config": { "view": { "stroke": null } }
}
```

### Vertical Bar Chart (Safer for Many Categories)

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 450,
  "height": 300,
  "data": {
    "values": [
      { "month": "Jan", "revenue": 4200 },
      { "month": "Feb", "revenue": 3800 },
      { "month": "Mar", "revenue": 5100 }
    ]
  },
  "mark": { "type": "bar", "cornerRadius": 3 },
  "encoding": {
    "x": { "field": "month", "type": "ordinal", "title": null, "axis": { "labelAngle": 0 } },
    "y": {
      "field": "revenue",
      "type": "quantitative",
      "title": "Revenue ($)",
      "scale": { "zero": true }
    }
  }
}
```

### Time Series with Area, Line, Points

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": { "text": "Daily Temperature", "subtitle": "December 2025", "anchor": "start" },
  "width": 600,
  "height": 200,
  "data": {
    "values": [
      { "date": "2025-12-01", "temp": 18.5 },
      { "date": "2025-12-08", "temp": 21.2 },
      { "date": "2025-12-15", "temp": 22.0 },
      { "date": "2025-12-22", "temp": 19.1 },
      { "date": "2025-12-29", "temp": 17.8 }
    ]
  },
  "layer": [
    { "mark": { "type": "area", "opacity": 0.2, "color": "#e45756" } },
    { "mark": { "type": "line", "color": "#e45756", "strokeWidth": 2 } },
    { "mark": { "type": "point", "color": "#e45756", "filled": true, "size": 50 } },
    {
      "mark": { "type": "rule", "strokeDash": [4, 4], "color": "#999" },
      "encoding": { "y": { "datum": 20 } }
    }
  ],
  "encoding": {
    "x": { "field": "date", "type": "temporal", "title": null, "axis": { "format": "%b %d" } },
    "y": {
      "field": "temp",
      "type": "quantitative",
      "title": "Temperature (°C)",
      "scale": { "domain": [15, 25] }
    }
  },
  "config": { "view": { "stroke": null } }
}
```

### Multi-Line Chart with Direct Labels

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": { "text": "Performance by Team", "anchor": "start" },
  "width": 500,
  "height": 280,
  "data": {
    "values": [
      { "date": "2025-01", "team": "Alpha", "score": 72 },
      { "date": "2025-02", "team": "Alpha", "score": 78 },
      { "date": "2025-03", "team": "Alpha", "score": 85 },
      { "date": "2025-01", "team": "Beta", "score": 65 },
      { "date": "2025-02", "team": "Beta", "score": 70 },
      { "date": "2025-03", "team": "Beta", "score": 68 }
    ]
  },
  "layer": [
    {
      "mark": { "type": "line", "strokeWidth": 2.5, "point": { "filled": true, "size": 50 } }
    },
    {
      "transform": [{ "filter": "datum.date == '2025-03'" }],
      "mark": { "type": "text", "align": "left", "dx": 8, "fontSize": 12, "fontWeight": "bold" },
      "encoding": { "text": { "field": "team" } }
    }
  ],
  "encoding": {
    "x": { "field": "date", "type": "ordinal", "title": null },
    "y": {
      "field": "score",
      "type": "quantitative",
      "title": "Score",
      "scale": { "domain": [60, 90] }
    },
    "color": {
      "field": "team",
      "type": "nominal",
      "scale": { "range": ["#4c78a8", "#f58518"] },
      "legend": null
    }
  }
}
```

### Heatmap with Labels

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": { "text": "Activity by Day and Hour", "anchor": "start" },
  "width": 400,
  "height": 250,
  "data": {
    "values": [
      { "day": "Mon", "hour": "9am", "activity": 45 },
      { "day": "Mon", "hour": "12pm", "activity": 78 },
      { "day": "Mon", "hour": "3pm", "activity": 62 },
      { "day": "Tue", "hour": "9am", "activity": 52 },
      { "day": "Tue", "hour": "12pm", "activity": 85 },
      { "day": "Tue", "hour": "3pm", "activity": 70 }
    ]
  },
  "mark": { "type": "rect", "cornerRadius": 2 },
  "encoding": {
    "x": { "field": "hour", "type": "ordinal", "title": null },
    "y": { "field": "day", "type": "nominal", "title": null },
    "color": {
      "field": "activity",
      "type": "quantitative",
      "scale": { "scheme": "blues" },
      "title": "Activity"
    }
  }
}
```

### Grouped Bar Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 400,
  "height": 250,
  "data": {
    "values": [
      { "category": "A", "group": "2024", "value": 28 },
      { "category": "A", "group": "2025", "value": 35 },
      { "category": "B", "group": "2024", "value": 45 },
      { "category": "B", "group": "2025", "value": 52 }
    ]
  },
  "mark": { "type": "bar", "cornerRadius": 2 },
  "encoding": {
    "x": { "field": "category", "type": "nominal", "title": null },
    "y": { "field": "value", "type": "quantitative", "title": "Value" },
    "xOffset": { "field": "group", "type": "nominal" },
    "color": {
      "field": "group",
      "type": "nominal",
      "title": "Year",
      "scale": { "range": ["#4c78a8", "#72b7b2"] }
    }
  }
}
```

### Stacked Bar Chart

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 400,
  "height": 250,
  "data": {
    "values": [
      { "month": "Jan", "category": "Product A", "sales": 30 },
      { "month": "Jan", "category": "Product B", "sales": 25 },
      { "month": "Feb", "category": "Product A", "sales": 35 },
      { "month": "Feb", "category": "Product B", "sales": 28 }
    ]
  },
  "mark": "bar",
  "encoding": {
    "x": { "field": "month", "type": "ordinal", "title": null },
    "y": { "field": "sales", "type": "quantitative", "stack": "zero", "title": "Sales" },
    "color": { "field": "category", "type": "nominal", "title": null }
  }
}
```

### Scatter Plot with Trend Line

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 400,
  "height": 300,
  "data": {
    "values": [
      { "x": 1, "y": 2.1 },
      { "x": 2, "y": 3.8 },
      { "x": 3, "y": 4.2 },
      { "x": 4, "y": 5.5 },
      { "x": 5, "y": 6.1 },
      { "x": 6, "y": 7.9 }
    ]
  },
  "layer": [
    {
      "mark": { "type": "point", "filled": true, "size": 60, "opacity": 0.7 }
    },
    {
      "mark": { "type": "line", "color": "firebrick", "strokeWidth": 2 },
      "transform": [{ "regression": "y", "on": "x" }]
    }
  ],
  "encoding": {
    "x": { "field": "x", "type": "quantitative", "title": "X Variable" },
    "y": { "field": "y", "type": "quantitative", "title": "Y Variable" }
  }
}
```

### Box Plot

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "width": 400,
  "height": 250,
  "data": {
    "values": [
      { "category": "A", "value": 10 },
      { "category": "A", "value": 15 },
      { "category": "A", "value": 20 },
      { "category": "A", "value": 25 },
      { "category": "B", "value": 30 },
      { "category": "B", "value": 35 },
      { "category": "B", "value": 40 },
      { "category": "B", "value": 45 }
    ]
  },
  "mark": "boxplot",
  "encoding": {
    "x": { "field": "category", "type": "nominal", "title": null },
    "y": { "field": "value", "type": "quantitative", "title": "Value" }
  }
}
```

### ❌ AVOID: Donut Chart

Use sorted bar chart instead - see "Never Use Pie or Donut Charts" in Best Practices.

---

## Advanced Techniques

### Layered Area with Line and Points

```json
{
  "layer": [
    {
      "mark": { "type": "area", "opacity": 0.3 },
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    },
    {
      "mark": { "type": "line" },
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    },
    {
      "mark": { "type": "point", "filled": true },
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" }
      }
    }
  ]
}
```

### Line with Trend Overlay

```json
{
  "layer": [
    {
      "mark": { "type": "point", "opacity": 0.3 },
      "encoding": {
        "x": { "field": "x", "type": "quantitative" },
        "y": { "field": "y", "type": "quantitative" }
      }
    },
    {
      "mark": { "type": "line", "color": "firebrick" },
      "transform": [{ "regression": "y", "on": "x" }],
      "encoding": {
        "x": { "field": "x", "type": "quantitative" },
        "y": { "field": "y", "type": "quantitative" }
      }
    }
  ]
}
```

### Dual-Axis Chart

```json
{
  "layer": [
    {
      "mark": "bar",
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "precipitation", "type": "quantitative", "title": "Precipitation (mm)" }
      }
    },
    {
      "mark": { "type": "line", "color": "firebrick" },
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "temperature", "type": "quantitative", "title": "Temperature (°C)" }
      }
    }
  ],
  "resolve": { "scale": { "y": "independent" } }
}
```

### Faceted Dashboard

```json
{
  "vconcat": [
    {
      "hconcat": [
        {
          "repeat": {"row": ["x1", "x2"], "column": ["x1", "x2"]},
          "spec": {
            "mark": "point",
            "encoding": {
              "x": {"field": {"repeat": "column"}, "type": "quantitative"},
              "y": {"field": {"repeat": "row"}, "type": "quantitative"}
            }
          }
        },
        {
          "repeat": {"row": ["y1", "y2"]},
          "spec": {
            "layer": [
              {"mark": "bar", "encoding": {...}},
              {"mark": "rule", "encoding": {...}}
            ]
          }
        }
      ]
    },
    {
      "facet": {"column": {"field": "category"}},
      "spec": {"mark": "bar", "encoding": {...}}
    }
  ]
}
```

---

## Best Practices

### 1. Never Use Pie or Donut Charts

Humans cannot accurately compare arc lengths or angles. **Always use sorted bar charts instead.**

```json
// ❌ AVOID - pie/donut charts
{"mark": {"type": "arc", "innerRadius": 50}}

// ✅ USE - sorted horizontal bar chart
{
  "mark": "bar",
  "encoding": {
    "y": {"field": "category", "sort": "-x"},
    "x": {"field": "value"}
  }
}
```

### 2. Use Color to Encode Data, Not Decorate

Color should highlight, not decorate:

- **Single series = single color** (don't add rainbow gradients)
- Reserve color for encoding **meaningful data dimensions** (e.g., floor level, status)
- Prefer **sequential** schemes for quantitative data
- Use **categorical** schemes only for nominal data (≤10 categories)

**Good - color encodes floor:**

```json
"color": {"field": "floor", "scale": {"domain": ["Ground", "Basement"], "range": ["#4c78a8", "#72b7b2"]}}
```

**Bad - color is decoration:**

```json
"color": {"field": "category", "scale": {"scheme": "rainbow"}}
```

### 3. Annotate Values Directly on Bars

Don't make readers estimate from axis - show the number:

```json
{
  "layer": [
    { "mark": "bar" },
    {
      "mark": { "type": "text", "align": "left", "dx": 5, "fontSize": 11 },
      "encoding": { "text": { "field": "value", "format": "," } }
    }
  ]
}
```

### 4. Sort by Value, Not Alphabetically

```json
"encoding": {
  "y": {"field": "category", "sort": "-x"}
}
```

### 5. Use Proper Aspect Ratios

| Chart Type   | Aspect Ratio             | Example                   |
| ------------ | ------------------------ | ------------------------- |
| Time series  | 3:1 to 4:1 (wide)        | `width: 600, height: 200` |
| Bar chart    | Height per category      | 8 bars → `height: 300`    |
| Heatmap      | Based on data dimensions | Match row/column count    |
| Scatter plot | Square or slight wide    | `width: 400, height: 350` |

```json
// ❌ WRONG - time series too tall
{"width": 400, "height": 600}

// ✅ CORRECT - time series wide
{"width": 600, "height": 200}
```

### 6. Direct Label Instead of Legends

Legends force eye movement. Label directly on the chart:

```json
{
  "layer": [
    {
      "mark": { "type": "line", "strokeWidth": 2 },
      "encoding": { "color": { "field": "series", "legend": null } }
    },
    {
      "mark": { "type": "text", "align": "left", "dx": 8, "fontWeight": "bold" },
      "transform": [{ "filter": "datum.date == '2025-12-29'" }],
      "encoding": {
        "x": { "field": "date", "type": "temporal" },
        "y": { "field": "value", "type": "quantitative" },
        "text": { "field": "series" },
        "color": { "field": "series", "legend": null }
      }
    }
  ]
}
```

### 7. Add Reference Lines for Context

Help readers interpret values:

```json
{
  "layer": [
    {"mark": "bar", "encoding": {...}},
    {
      "mark": {"type": "rule", "strokeDash": [4, 4], "color": "#999"},
      "encoding": {"y": {"datum": 20}}
    },
    {
      "mark": {"type": "text", "align": "left", "dx": 5, "color": "#666"},
      "encoding": {
        "y": {"datum": 20},
        "text": {"value": "Target: 20"}
      }
    }
  ]
}
```

### 8. Include Titles and Subtitles

Explain what the reader is looking at:

```json
"title": {
  "text": "Temperature by Room",
  "subtitle": "Daily averages, December 2025",
  "anchor": "start",
  "fontSize": 16,
  "subtitleFontSize": 12,
  "subtitleColor": "#666"
}
```

### 9. Use Small Multiples Over Complexity

Instead of overloading one chart with many encodings, use faceting:

```json
{
  "mark": "line",
  "encoding": {
    "column": { "field": "region", "type": "nominal" },
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "value", "type": "quantitative" }
  }
}
```

---

## Configuration

### Global Config

```json
{
  "config": {
    "view": { "stroke": null, "continuousWidth": 400, "continuousHeight": 300 },
    "axis": { "labelFontSize": 12, "titleFontSize": 14 },
    "title": { "fontSize": 16, "fontWeight": "bold" },
    "legend": { "labelFontSize": 11, "titleFontSize": 12 },
    "bar": { "color": "#4c78a8" },
    "line": { "strokeWidth": 2 },
    "point": { "size": 60 }
  }
}
```

### Typography

```json
"config": {
  "font": "Helvetica Neue",
  "axis": {
    "labelFont": "Helvetica Neue",
    "titleFont": "Helvetica Neue"
  }
}
```

---

## Professional Theming

Consistent theming across charts creates a professional, cohesive look. These themes align with the Graphviz theming in this skill.

### Visual Design Principles

Three approaches to visualization design, each suited to different audiences:

#### Minimalist (Data-Ink Ratio)

Maximize data, minimize non-data ink:

- Remove decorative elements that don't encode information
- Use position and length as primary encodings (most accurate)
- Avoid chartjunk (3D effects, gradients, unnecessary fills)
- Every pixel should convey data

**When to apply:** Technical documentation, data-dense dashboards, publications.

**Limitation:** Can be too sparse for audiences who need visual anchors.

#### Communicative (Functional Clarity)

Emphasize communication over minimalism:

- **Functional decoration is not chartjunk** — grid lines, reference marks aid reading
- **Redundant encoding for critical data** — alerts need color + size + position
- **Know your audience** — label for the least technical viewer
- **Guide the eye** — create visual hierarchy that leads to the insight
- **Title states the insight** — not just what the chart shows, but what it means

**When to apply:** Operational dashboards, presentations to mixed audiences, alerting systems.

#### Modern SaaS (Clean Professional)

Clean, professional design for modern tooling:

- **White space is design** — let elements breathe
- **One accent color** — gray scale for structure, color for emphasis only
- **No gradients, no shadows** — flat, honest design
- **Typography carries hierarchy** — weight and size, not decoration
- **Thin lines, subtle gridlines** — `#e5e5e5` not black

**When to apply:** Product documentation, engineering blogs, modern dashboards.

#### Choosing an Approach

| Audience               | Approach      | Style                     |
| ---------------------- | ------------- | ------------------------- |
| Engineers reading docs | Minimalist    | Sparse, data-dense        |
| Ops team monitoring    | Communicative | Clear, redundant encoding |
| Product/stakeholders   | Modern SaaS   | Clean, professional       |
| Print/publication      | Minimalist    | High information density  |

### Light Theme

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "background": "white",
  "config": {
    "font": "Arial",
    "title": {
      "color": "#171717",
      "subtitleColor": "#737373",
      "fontSize": 16,
      "subtitleFontSize": 12,
      "anchor": "start"
    },
    "axis": {
      "labelColor": "#525252",
      "titleColor": "#525252",
      "gridColor": "#e5e5e5",
      "domainColor": "#d4d4d4",
      "tickColor": "#d4d4d4"
    },
    "legend": {
      "labelColor": "#525252",
      "titleColor": "#525252"
    },
    "view": { "stroke": null }
  }
}
```

**Light palette:**

| Element        | Color     | Usage                     |
| -------------- | --------- | ------------------------- |
| Background     | `#ffffff` | Chart background          |
| Primary text   | `#171717` | Titles, labels            |
| Secondary text | `#525252` | Axis labels, annotations  |
| Muted text     | `#737373` | Subtitles, secondary info |
| Grid lines     | `#e5e5e5` | Subtle grid               |
| Domain/tick    | `#d4d4d4` | Axis lines                |
| Normal data    | `#a3a3a3` | Default bars, lines       |
| Error/alert    | `#dc2626` | Problem indicators        |
| Warning        | `#f97316` | Threshold lines           |

### Dark Theme

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "background": "#0a0a0a",
  "config": {
    "font": "Arial",
    "title": {
      "color": "#e5e5e5",
      "subtitleColor": "#a3a3a3",
      "fontSize": 16,
      "subtitleFontSize": 12,
      "anchor": "start"
    },
    "axis": {
      "labelColor": "#a3a3a3",
      "titleColor": "#a3a3a3",
      "gridColor": "#262626",
      "domainColor": "#404040",
      "tickColor": "#404040"
    },
    "legend": {
      "labelColor": "#a3a3a3",
      "titleColor": "#a3a3a3"
    },
    "view": { "stroke": null }
  }
}
```

**Dark palette:**

| Element        | Color     | Usage                                     |
| -------------- | --------- | ----------------------------------------- |
| Background     | `#0a0a0a` | Chart background                          |
| Primary text   | `#e5e5e5` | Titles, labels                            |
| Secondary text | `#a3a3a3` | Axis labels, annotations                  |
| Muted text     | `#737373` | Secondary info                            |
| Grid lines     | `#262626` | Subtle grid                               |
| Domain/tick    | `#404040` | Axis lines                                |
| Normal data    | `#525252` | Default bars, lines                       |
| Error/alert    | `#f87171` | Problem indicators (lighter for contrast) |
| Warning        | `#fb923c` | Threshold lines                           |

### Color Encoding Strategy

Use color sparingly and consistently:

```json
{
  "color": {
    "condition": { "test": "datum.error_rate > 5", "value": "#dc2626" },
    "value": "#a3a3a3"
  }
}
```

**Rules:**

1. **Gray is the default** — only use color when it encodes meaning
2. **Red for errors only** — don't dilute its meaning
3. **One accent per chart** — avoid rainbow palettes
4. **Consistent across dashboard** — same colors mean same things

### Title with Insight

Don't just label what the chart shows—state what it means:

```json
{
  "title": {
    "text": "Service Error Rates",
    "subtitle": "telegram-bot exceeds 5% SLO threshold",
    "color": "#171717",
    "subtitleColor": "#737373",
    "anchor": "start"
  }
}
```

**Bad:** "Error Rate by Service"
**Good:** "telegram-bot exceeds 5% SLO threshold"

### Reference Lines for Context

Add threshold/target lines to give context:

```json
{
  "layer": [
    {
      "data": {"values": [{"threshold": 5}]},
      "mark": {"type": "rule", "strokeDash": [4, 4], "strokeWidth": 1.5},
      "encoding": {
        "y": {"field": "threshold", "type": "quantitative"},
        "color": {"value": "#f97316"}
      }
    },
    {
      "data": {"values": [{"threshold": 5, "label": "5% SLO"}]},
      "mark": {"type": "text", "align": "right", "dy": -8, "fontSize": 10},
      "encoding": {
        "y": {"field": "threshold", "type": "quantitative"},
        "x": {"value": "width"},
        "text": {"field": "label"},
        "color": {"value": "#f97316"}
      }
    },
    {
      "mark": "bar",
      "encoding": {...}
    }
  ]
}
```

### Direct Labeling over Legends

Place labels directly on data points instead of using legends:

```json
{
  "layer": [
    {
      "mark": { "type": "line", "strokeWidth": 2 },
      "encoding": {
        "color": { "field": "service", "legend": null }
      }
    },
    {
      "mark": { "type": "text", "align": "left", "dx": 8, "fontSize": 11 },
      "transform": [{ "filter": "datum.time == 'final_point'" }],
      "encoding": {
        "text": { "field": "service" },
        "color": { "field": "service", "legend": null }
      }
    }
  ]
}
```

### Value Labels on Bars

Add the actual values as text marks:

```json
{
  "layer": [
    {
      "mark": { "type": "bar", "cornerRadiusEnd": 3 },
      "encoding": {
        "y": { "field": "service", "sort": "-x" },
        "x": { "field": "count" }
      }
    },
    {
      "mark": { "type": "text", "align": "left", "dx": 5, "fontSize": 11 },
      "encoding": {
        "y": { "field": "service", "sort": "-x" },
        "x": { "field": "count" },
        "text": { "field": "count", "format": ",.0f" },
        "color": { "value": "#525252" }
      }
    }
  ]
}
```

### Complete Example: Service Health Dashboard

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
  "title": {
    "text": "Service Error Rates",
    "subtitle": "telegram-bot exceeds 5% SLO threshold",
    "color": "#171717",
    "subtitleColor": "#737373",
    "fontSize": 16,
    "subtitleFontSize": 12,
    "anchor": "start"
  },
  "width": 450,
  "height": 180,
  "background": "white",
  "config": {
    "font": "Arial",
    "axis": {
      "labelColor": "#525252",
      "titleColor": "#525252",
      "gridColor": "#f5f5f5",
      "domainColor": "#d4d4d4",
      "tickColor": "#d4d4d4"
    },
    "view": { "stroke": null }
  },
  "layer": [
    {
      "data": { "values": [{ "threshold": 5 }] },
      "mark": { "type": "rule", "strokeDash": [4, 4], "strokeWidth": 1.5 },
      "encoding": {
        "x": { "field": "threshold", "type": "quantitative" },
        "color": { "value": "#f97316" }
      }
    },
    {
      "data": {
        "values": [
          { "service": "telegram-bot", "error_rate": 8.05 },
          { "service": "web-api", "error_rate": 0.33 },
          { "service": "web-client", "error_rate": 0.23 },
          { "service": "mcp-server", "error_rate": 0.16 }
        ]
      },
      "mark": { "type": "bar", "cornerRadiusEnd": 3 },
      "encoding": {
        "y": {
          "field": "service",
          "type": "nominal",
          "sort": "-x",
          "title": null,
          "axis": { "labelLimit": 150 }
        },
        "x": {
          "field": "error_rate",
          "type": "quantitative",
          "title": "Error Rate %",
          "scale": { "domain": [0, 10] }
        },
        "color": {
          "condition": { "test": "datum.error_rate > 5", "value": "#dc2626" },
          "value": "#a3a3a3"
        }
      }
    },
    {
      "data": {
        "values": [
          { "service": "telegram-bot", "error_rate": 8.05 },
          { "service": "web-api", "error_rate": 0.33 },
          { "service": "web-client", "error_rate": 0.23 },
          { "service": "mcp-server", "error_rate": 0.16 }
        ]
      },
      "mark": { "type": "text", "align": "left", "dx": 5, "fontSize": 11 },
      "encoding": {
        "y": { "field": "service", "sort": "-x" },
        "x": { "field": "error_rate" },
        "text": { "field": "error_rate", "format": ".2f" },
        "color": {
          "condition": { "test": "datum.error_rate > 5", "value": "#dc2626" },
          "value": "#525252"
        }
      }
    }
  ]
}
```

### Quick Reference: Quality Checklist

Before finalizing any chart, verify:

- [ ] **Title states the insight** (not just what the chart shows)
- [ ] **Subtitle provides context** if needed
- [ ] **One accent color** — red for errors, gray for normal
- [ ] **Sort bars by value** (`sort: "-x"`) not alphabetically
- [ ] **Value labels** on bars for precise reading
- [ ] **Direct labels** on lines instead of legends
- [ ] **Reference lines** for thresholds/targets with labels
- [ ] **Adequate dimensions** — 3:1 for time series, height for bar charts
- [ ] **Simple field names** — no dots in field names
- [ ] **Consistent theming** — same colors mean same things across charts

## References

- [Vega-Lite Documentation](https://vega.github.io/vega-lite/docs/)
- [Vega-Lite Examples](https://vega.github.io/vega-lite/examples/)
- [UW Visualization Curriculum](https://idl.uw.edu/visualization-curriculum/intro.html)
- [Altair Documentation](https://altair-viz.github.io/)

### Visual Design References

- _Sémiologie Graphique_ (1967) — semiotics of graphics, visual variables
- _The Visual Display of Quantitative Information_ (1983) — data-ink ratio, minimalist approach
- _The Functional Art_, _How Charts Lie_ — clarity over minimalism, communicative approach
- _Visualization Analysis and Design_ (2014) — systematic approach to visualization design
