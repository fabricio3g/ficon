import type { FunctionalComponent, SVGAttributes } from 'vue';

export interface IconProps {
  /** Width and height in px; a sizing class (`size-4`) wins over it. Default 24. */
  size?: number | string;
  /** `regular` is 1.5, `slim` is 1 with smaller dots. Unset, the icon takes the
   *  weight of the nearest `.ficon-slim` / `.ficon-regular` ancestor, else regular. */
  weight?: 'regular' | 'slim';
  /** An exact stroke weight on the 16px grid; wins over `weight`. */
  strokeWidth?: number | string;
  color?: string;
}

/** Any icon of the set — the type to ask for when a component takes one. */
export type Icon = FunctionalComponent<IconProps & SVGAttributes>;
