import type { Component } from 'svelte';
import type { SVGAttributes } from 'svelte/elements';

export interface IconProps extends Omit<SVGAttributes<SVGSVGElement>, 'children'> {
  /** Width and height in px; a sizing class (`size-4`) wins over it. */
  size?: number | string;
  /** Stroke weight on the 16px grid. The set is drawn for 1.5. */
  strokeWidth?: number | string;
  color?: string;
  class?: string;
}

/** Any icon of the set — the type to ask for when a component takes one. */
export type Icon = Component<IconProps>;
