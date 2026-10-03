export interface CategoricalColor {
  /** Solid hue — dot, bar, chip text */
  solid: string;
  /** ~10% tint for group backgrounds */
  bg: string;
  /** ~20% tint for group borders */
  border: string;
}

const CATEGORICAL_VARS = [
  "--color-cat-1",
  "--color-cat-2",
  "--color-cat-3",
  "--color-cat-4",
  "--color-cat-5",
  "--color-cat-6",
];

const cache = new Map<string, CategoricalColor>();

/**
 * Reads a categorical hue from CSS and derives its tints with color-mix(), so
 * the palette lives in globals.css as six variables instead of being
 * duplicated per component. Values are strings, not numbers, because every
 * consumer writes them into a `style` prop.
 */
export function categoricalColor(index: number): CategoricalColor {
  const slot = ((index % CATEGORICAL_VARS.length) + CATEGORICAL_VARS.length) % CATEGORICAL_VARS.length;
  const cached = cache.get(String(slot));
  if (cached) return cached;

  const solid = `var(${CATEGORICAL_VARS[slot]})`;
  const color: CategoricalColor = {
    solid,
    bg: `color-mix(in oklab, ${solid} 10%, transparent)`,
    border: `color-mix(in oklab, ${solid} 22%, transparent)`,
  };
  cache.set(String(slot), color);
  return color;
}

/** Stable slot per speaker label, so a speaker keeps their colour across renders. */
export function speakerColor(speaker: string): CategoricalColor {
  let hash = 0;
  for (let i = 0; i < speaker.length; i += 1) {
    hash = (hash * 31 + speaker.charCodeAt(i)) | 0;
  }
  return categoricalColor(Math.abs(hash));
}
