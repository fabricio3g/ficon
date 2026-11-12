// The one component every ficon React icon is made from. Written by hand; react/index.js is generated.
import { createElement, forwardRef } from 'react';

/** SVG attribute names as React spells them. */
const REACT_NAME = { class: 'className' };

/**
 * Makes a component for one icon. `className`, `style`, handlers and any other prop land on
 * the <svg>, and a ref reaches the <svg> element, so `className="size-4"` sizes it.
 */
export function createIcon(glyph, displayName, shapes) {
  const children = shapes.map(([tag, attrs], index) => {
    const props = { key: index };
    for (const [name, value] of Object.entries(attrs)) props[REACT_NAME[name] ?? name] = value;
    return createElement(tag, props);
  });
  const Icon = forwardRef(function Icon(
    { size = 24, weight, strokeWidth, color = 'currentColor', className, style, ...rest },
    ref,
  ) {
    const labelled = rest['aria-label'] != null || rest['aria-labelledby'] != null;
    return createElement(
      'svg',
      {
        xmlns: 'http://www.w3.org/2000/svg',
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: color,
        strokeWidth: 1.5,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': labelled ? undefined : true,
        ...rest,
        ref,
        className: ['ficon', `ficon-${glyph}`, weight && `ficon-${weight}`, className].filter(Boolean).join(' '),
        style: strokeWidth != null ? { '--ficon-stroke': String(strokeWidth), ...style } : style,
      },
      children,
    );
  });
  Icon.displayName = displayName;
  return Icon;
}
