// The one component every ficon Vue icon is made from. Written by hand; vue/index.js is generated.
import { h } from 'vue';

const SVG = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 16 16',
  fill: 'none',
  'stroke-width': '1.5',
  'stroke-linecap': 'round',
  'stroke-linejoin': 'round',
};

/**
 * Makes a functional component for one icon. `class`, `style`, listeners and any other
 * attribute fall through onto the <svg>, so `class="size-4"` sizes it.
 */
export function createIcon(glyph, displayName, shapes) {
  const children = () => shapes.map(([tag, attrs]) => h(tag, attrs));
  const Icon = (props, { attrs }) => {
    const size = props.size ?? 24;
    const labelled = attrs['aria-label'] != null || attrs['aria-labelledby'] != null;
    return h(
      'svg',
      {
        ...SVG,
        width: size,
        height: size,
        stroke: props.color ?? 'currentColor',
        'aria-hidden': labelled ? undefined : 'true',
        class: ['ficon', `ficon-${glyph}`, props.weight && `ficon-${props.weight}`],
        style: props.strokeWidth != null ? { '--ficon-stroke': String(props.strokeWidth) } : undefined,
      },
      children(),
    );
  };
  Icon.props = ['size', 'weight', 'strokeWidth', 'color'];
  Icon.displayName = displayName;
  return Icon;
}
