# Eddo Design Tokens

Centralized design system tokens for consistent styling across the application.

## Overview

Design tokens are defined in `design-tokens.css` using Tailwind CSS v4's `@theme` directive. These tokens become available as Tailwind utility classes automatically.

## Typography

### Font Families

| Token         | Value            | Usage                |
| ------------- | ---------------- | -------------------- |
| `--font-sans` | Inter Variable   | Primary UI font      |
| `--font-mono` | System monospace | Code, Kanban columns |

**Classes:** `font-sans`, `font-mono`

### Font Sizes

| Token         | Size            | Usage                        |
| ------------- | --------------- | ---------------------------- |
| `--text-xs`   | 12px (0.75rem)  | Metadata, timestamps, badges |
| `--text-sm`   | 14px (0.875rem) | Body text, secondary content |
| `--text-base` | 16px (1rem)     | Primary content, emphasis    |
| `--text-lg`   | 18px (1.125rem) | Section headers              |
| `--text-xl`   | 20px (1.25rem)  | Page titles                  |
| `--text-2xl`  | 24px (1.5rem)   | Major headings               |
| `--text-3xl`  | 30px (1.875rem) | Hero text                    |

**Classes:** `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`

### Line Heights

| Token               | Value | Usage               |
| ------------------- | ----- | ------------------- |
| `--leading-none`    | 1     | Single-line text    |
| `--leading-tight`   | 1.25  | Headings            |
| `--leading-snug`    | 1.375 | Compact text        |
| `--leading-normal`  | 1.5   | Body text (default) |
| `--leading-relaxed` | 1.625 | Long-form content   |

**Classes:** `leading-none`, `leading-tight`, `leading-snug`, `leading-normal`, `leading-relaxed`

## Spacing

Base unit: 4px (0.25rem)

| Token           | Size     | Pixels |
| --------------- | -------- | ------ |
| `--spacing-0`   | 0        | 0      |
| `--spacing-0-5` | 0.125rem | 2px    |
| `--spacing-1`   | 0.25rem  | 4px    |
| `--spacing-1-5` | 0.375rem | 6px    |
| `--spacing-2`   | 0.5rem   | 8px    |
| `--spacing-3`   | 0.75rem  | 12px   |
| `--spacing-4`   | 1rem     | 16px   |
| `--spacing-5`   | 1.25rem  | 20px   |
| `--spacing-6`   | 1.5rem   | 24px   |
| `--spacing-8`   | 2rem     | 32px   |
| `--spacing-10`  | 2.5rem   | 40px   |
| `--spacing-12`  | 3rem     | 48px   |
| `--spacing-16`  | 4rem     | 64px   |
| `--spacing-20`  | 5rem     | 80px   |
| `--spacing-24`  | 6rem     | 96px   |

**Usage:** Applies to padding, margin, gap, width, height utilities.

## Colors

### Semantic Color Scales

Each color has 11 shades (50-950) using OKLCH color space for perceptual uniformity.

| Scale     | Hue           | Usage                         |
| --------- | ------------- | ----------------------------- |
| `primary` | Blue (250°)   | Actions, links, focus states  |
| `neutral` | Gray          | Text, backgrounds, borders    |
| `success` | Green (145°)  | Success states, confirmations |
| `warning` | Amber (85°)   | Warnings, cautions            |
| `error`   | Red (25°)     | Errors, destructive actions   |
| `accent`  | Purple (290°) | Highlights, special elements  |

**Classes:** `bg-primary-500`, `text-neutral-600`, `border-error-300`, etc.

### Semantic Aliases

For common use cases, use semantic aliases that automatically adapt to dark mode:

| Token                     | Light Mode  | Dark Mode   | Usage                 |
| ------------------------- | ----------- | ----------- | --------------------- |
| `--color-bg`              | neutral-50  | neutral-950 | Page background       |
| `--color-bg-subtle`       | neutral-100 | neutral-900 | Card backgrounds      |
| `--color-bg-muted`        | neutral-200 | neutral-800 | Hover states          |
| `--color-bg-emphasis`     | neutral-900 | neutral-100 | Inverted backgrounds  |
| `--color-fg`              | neutral-900 | neutral-100 | Primary text          |
| `--color-fg-muted`        | neutral-600 | neutral-400 | Secondary text        |
| `--color-fg-subtle`       | neutral-400 | neutral-500 | Placeholder, disabled |
| `--color-fg-on-emphasis`  | neutral-50  | neutral-900 | Text on emphasis bg   |
| `--color-border`          | neutral-200 | neutral-800 | Default borders       |
| `--color-border-muted`    | neutral-100 | neutral-900 | Subtle borders        |
| `--color-border-emphasis` | neutral-400 | neutral-600 | Strong borders        |

**Usage in CSS:**

```css
.my-component {
  background-color: var(--color-bg-subtle);
  color: var(--color-fg);
  border-color: var(--color-border);
}
```

## Border Radius

| Token              | Size   | Usage                     |
| ------------------ | ------ | ------------------------- |
| `--radius-none`    | 0      | No rounding               |
| `--radius-sm`      | 2px    | Subtle rounding           |
| `--radius-default` | 4px    | Default (buttons, inputs) |
| `--radius-md`      | 6px    | Medium elements           |
| `--radius-lg`      | 8px    | Cards, modals             |
| `--radius-xl`      | 12px   | Large containers          |
| `--radius-2xl`     | 16px   | Extra large               |
| `--radius-full`    | 9999px | Pills, avatars            |

**Classes:** `rounded-sm`, `rounded`, `rounded-md`, `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full`

## Shadows

| Token              | Usage               |
| ------------------ | ------------------- |
| `--shadow-sm`      | Subtle elevation    |
| `--shadow-default` | Cards, buttons      |
| `--shadow-md`      | Dropdowns, popovers |
| `--shadow-lg`      | Modals, dialogs     |
| `--shadow-xl`      | Major overlays      |

**Classes:** `shadow-sm`, `shadow`, `shadow-md`, `shadow-lg`, `shadow-xl`

## Transitions

### Durations

| Token               | Value | Usage                |
| ------------------- | ----- | -------------------- |
| `--duration-fast`   | 100ms | Micro-interactions   |
| `--duration-normal` | 200ms | Standard transitions |
| `--duration-slow`   | 300ms | Complex animations   |

### Easing

| Token            | Usage             |
| ---------------- | ----------------- |
| `--ease-default` | Standard easing   |
| `--ease-in`      | Elements exiting  |
| `--ease-out`     | Elements entering |
| `--ease-in-out`  | Continuous motion |

## Dark Mode

Dark mode is handled automatically via `prefers-color-scheme: dark` media query. Semantic aliases (`--color-bg`, `--color-fg`, etc.) automatically adjust.

For manual dark mode classes, use Tailwind's `dark:` prefix:

```html
<div class="bg-neutral-100 dark:bg-neutral-900"></div>
```

## Migration Guide

Replace arbitrary values with tokens:

| Before            | After                                   |
| ----------------- | --------------------------------------- |
| `text-gray-600`   | `text-neutral-600` or `text-fg-muted`   |
| `bg-gray-100`     | `bg-neutral-100` or `bg-bg-subtle`      |
| `border-gray-200` | `border-neutral-200` or `border-border` |
| `text-blue-600`   | `text-primary-600`                      |
| `text-red-600`    | `text-error-600`                        |
| `text-green-600`  | `text-success-600`                      |
