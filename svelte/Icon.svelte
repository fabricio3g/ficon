<svelte:options runes={true} />

<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { IconProps } from './types';

  let {
    glyph,
    size = 24,
    strokeWidth = 1.5,
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
  stroke-width={strokeWidth}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden={rest['aria-label'] || rest['aria-labelledby'] ? undefined : 'true'}
  {...rest}
  class={['ficon', `ficon-${glyph}`, className]}
>{@render children()}</svg>
