<svelte:options runes={true} />

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconProps } from './types';

  let {
    glyph,
    size = 24,
    weight,
    strokeWidth,
    color = 'currentColor',
    class: className = '',
    children,
    ...rest
  }: IconProps & { glyph: string; children: Snippet } = $props();
</script>

<svg
  xmlns="http://www.w3.org/2000/svg"
  width={size}
  height={size}
  viewBox="0 0 16 16"
  fill="none"
  stroke={color}
  stroke-width="1.5"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden={rest['aria-label'] || rest['aria-labelledby'] ? undefined : 'true'}
  {...rest}
  class={['ficon', `ficon-${glyph}`, weight && `ficon-${weight}`, className]}
  style:--ficon-stroke={strokeWidth}
>{@render children()}</svg>
