// Type fixture for scripts/smoke.mjs: compiled with `tsc --noEmit --strict`, never run.
import { createRef } from 'react';
import { h } from 'vue';
import { Check, Lock, Images, AlertCircle, type Icon as ReactIcon, type IconProps as ReactIconProps } from 'ficon/react';
import * as Vue from 'ficon/vue';

// React: icons are components that take the documented props and forward a ref to <svg>.
const ref = createRef<SVGSVGElement>();
export const react = [
  <Check key="a" />,
  <Lock key="b" size={16} weight="slim" className="size-4" ref={ref} />,
  <Images key="c" strokeWidth={1.25} color="red" aria-label="Images" onClick={() => {}} />,
  <AlertCircle key="d" size="1em" weight="regular" />,
  // @ts-expect-error weights are regular and slim only
  <Check key="e" weight="bold" />,
];

const pick: ReactIcon = Lock;
export const props: ReactIconProps = { size: 16, weight: 'slim' };
// @ts-expect-error weights are regular and slim only
export const badProps: ReactIconProps = { weight: 'bold' };

// Vue: icons are functional components with the same props.
const vueIcon: Vue.Icon = Vue.Lock;
export const vue = [h(Vue.Check), h(vueIcon, { size: 16 }), h(Vue.Images, { weight: 'slim' })];
export const vueProps: Vue.IconProps = { size: 16, weight: 'slim', strokeWidth: 1 };
// @ts-expect-error weights are regular and slim only
export const vueBadProps: Vue.IconProps = { weight: 'bold' };

export { pick };
