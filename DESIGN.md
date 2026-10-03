# Design System — MeetingMind

The contract every UI change is checked against. If a rule here and the code
disagree, one of them is a bug. Tokens live in `src/app/globals.css`; this file
records intent and the reasoning behind it.

## Stack

- framework: Next.js 16 (App Router, Turbopack)
- styling: Tailwind CSS v4 (`@theme inline`), no config file
- components: hand-rolled, no component library
- animation: CSS keyframes + transitions, **no animation library**
- icons: lucide-react
- fonts: `next/font/google` — Space Grotesk (display), DM Sans (body), JetBrains Mono (numeric/meta)

## Tokens

Defined once in `src/app/globals.css`. Never hardcode a hex in a component.

### Surfaces — three elevation layers

| Token | Hex | Use |
|---|---|---|
| `bg-base` | `#0B0F14` | page background |
| `bg-surface` | `#111820` | cards, list rows |
| `bg-elevated` | `#1A2333` | popovers, menus, inputs |
| `bg-inset` | `#080B10` | wells, code blocks |

### Text — three steps, all WCAG AA

Contrast measured against `bg-elevated` (the lightest surface any of these sits
on), which is the worst case:

| Token | Hex | Contrast | Use |
|---|---|---|---|
| `text-primary` | `#EDF2FF` | 14.07:1 | headings, body copy |
| `text-secondary` | `#A8B8CE` | 7.82:1 | supporting copy, labels |
| `text-muted` | `#8499C0` | 5.48:1 | timestamps, counts, metadata |
| `text-inverse` | `#0B0F14` | — | text on `accent-primary` fills |

> `text-muted` was `#4A5E78` (2.37:1 — **failed AA**) across 48 usages. Retuned
> in the Phase 1 redesign. Do not darken it without re-running the contrast check.

### Brand, semantic, categorical

`accent-primary` `#4F8EF7` · `accent-purple` `#8B5CF6` · `success` `#34D399` ·
`warning` `#FBBF24` · `error` `#F87171`

`cat-1` … `cat-6` is the categorical scale for speaker identity, template
identity, and chart series. One definition in `globals.css`; read it through
`speakerColor()` / `categoricalColor()` in `src/lib/palette.ts`, which derives
background and border tints with `color-mix()`. Do not re-declare the palette
per component — that duplication is what this module replaced.

### Radius, shadow, motion

Radius is one value per role: `radius-control` 10px, `radius-card` 12px,
`radius-pill` for badges and avatars only. Shadows layer a tight+dark pass for
depth with a wide+soft pass for ambient (`sm` → `xl`). Motion: 120ms micro,
200ms UI, 320ms slow, all on `--ease-out-quart`.

### Layout

`page-shell` (min-height + background) and `page-container` (max-width +
centred + gutters) replace the per-page `min-h-screen bg-bg-base` and
`max-w-[720px]` boilerplate. `page-container-wide` is for marketing surfaces.

## Rules

1. **Tokens only.** No hex, no arbitrary values (`w-[347px]`, `text-[13px]`)
   unless a pixel-perfect requirement is stated here.
2. **All four interactive states** on anything clickable: `hover`, `active`,
   `focus-visible`, `disabled`. The global `:focus-visible` ring is never
   removed without a visible replacement.
3. **Every component ships a skeleton and an empty state.** Skeleton geometry
   must match the real layout it stands in for. The `.skeleton` class exists
   for this.
4. **Keyboard reachable.** No `onClick` on a `div` or `span`. Icon-only buttons
   carry `aria-label`. State is exposed via `aria-expanded` / `aria-pressed` /
   `aria-selected`, not only visually.
5. **Reduced motion is honoured globally** by the `prefers-reduced-motion`
   block at the end of `globals.css`. New animations are covered by it
   automatically; do not add per-component guards.
6. **Two breakpoints minimum** (`sm`, `lg`) with a stated collapse strategy.

## Components

| Component | Path | States |
|---|---|---|
| `cn()` | `src/lib/utils.ts` | — (utility) |
| `categoricalColor` / `speakerColor` | `src/lib/palette.ts` | — (utility) |

Primitives (Button, Input, Card, Badge, EmptyState, Skeleton, Tabs, Toast) are
Phase 2. Until they exist, components inline the tokens directly.

## Decisions

- **2026-10-03 — init.** Stack detected: `next-tailwind` preset. No shadcn, no
  `clsx`/`tailwind-merge`/`cva`, no animation library. `cn()` is a filter-join;
  conflict resolution is not needed anywhere in this app and three
  dependencies would be.
- **2026-10-03 — contrast fix.** Retuned `text-secondary` and `text-muted` so
  all three text steps pass AA on the worst-case surface. Previously `text-muted`
  failed at 2.37:1 across 48 usages.
- **2026-10-03 — font consolidation.** `--font-syne` was referenced by six
  components but never loaded by `layout.tsx`, so those headings silently fell
  back. All now use `--font-display` (Space Grotesk).
- **2026-10-03 — palette de-duplication.** The six-hue speaker/template palette
  was duplicated across four files. Centralised in `src/lib/palette.ts` over six
  CSS variables.
- **2026-10-03 — layout shell.** `page-shell` / `page-container` replace twelve
  copies of `min-h-screen bg-bg-base`.

## Non-Goals

- No light theme in this pass. Every token is a CSS variable, so one is
  addable without touching components, but it is not designed for here.
- No Figma sync, no image generation.
- No component library adoption.
