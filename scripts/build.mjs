#!/usr/bin/env node
/**
 * Builds ficon from `icons/*.svg`.
 *
 *   node scripts/build.mjs            lint + write svelte/ and dist/ficon.css
 *   node scripts/build.mjs --check    lint only (exit 1 on any error)
 *   node scripts/build.mjs --sheet f  also write a demo page to f
 *
 * The drawing and motion rules it enforces are in CONTRIBUTING.md.
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = join(root, 'svelte');
const svgDir = join(root, 'icons');
const outDir = join(iconsDir, 'generated');

const ROOT_TAG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">';

/** Old names the app still imports, drawn once under the name on the right. */
const ALIASES = {
  AlertCircle: 'CircleAlert',
  AlertTriangle: 'TriangleAlert',
  MoreHorizontal: 'Ellipsis',
  Loader2: 'LoaderCircle',
  XCircle: 'CircleX',
};

/** Icons that carry no hover motion of their own. */
const STILL = new Set(['loader-circle']);

const ELEMENTS = {
  path: ['d'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
};
const SHARED_ATTRS = ['class', 'pathLength', 'fill', 'stroke'];
const KEYFRAME_PROPS = new Set(['translate', 'rotate', 'scale', 'opacity', 'stroke-dashoffset']);
const RULE_PROPS = new Set(['animation', 'transform-origin', 'transform-box', 'stroke-dasharray']);
const HOVER = ":is(button, a, [role='menuitem'], [role='tab'], [role='option'], label, summary):not(:disabled):hover";

const pascal = (kebab) => kebab.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase());

// ── Parsing ──────────────────────────────────────────────────────────────

function parseAttrs(text) {
  const attrs = {};
  for (const m of text.matchAll(/([a-zA-Z][\w:-]*)\s*=\s*"([^"]*)"/g)) attrs[m[1]] = m[2];
  return attrs;
}

/** Vertices of a path in absolute coordinates (arc and curve end points only). */
function pathPoints(d) {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const arity = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const points = [];
  let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++];
    else if (!cmd) throw new Error('path starts with a number');
    const lower = cmd.toLowerCase();
    const rel = cmd === lower;
    if (!(lower in arity)) throw new Error(`unknown path command ${cmd}`);
    if (lower === 'z') { x = sx; y = sy; continue; }
    const args = [];
    for (let k = 0; k < arity[lower]; k += 1) {
      if (i >= tokens.length || /[a-zA-Z]/.test(tokens[i])) throw new Error(`path command ${cmd} is missing numbers`);
      args.push(num());
    }
    if (lower === 'h') x = rel ? x + args[0] : args[0];
    else if (lower === 'v') y = rel ? y + args[0] : args[0];
    else {
      if (lower === 'c' || lower === 's' || lower === 'q') {
        for (let k = 0; k + 3 < args.length; k += 2) points.push([rel ? x + args[k] : args[k], rel ? y + args[k + 1] : args[k + 1], true]);
      }
      const ex = args[args.length - 2], ey = args[args.length - 1];
      x = rel ? x + ex : ex;
      y = rel ? y + ey : ey;
    }
    points.push([x, y]);
    if (lower === 'm') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  }
  return points;
}

function elementPoints(tag, a) {
  const n = (k, fallback = 0) => (a[k] === undefined ? fallback : Number(a[k]));
  if (tag === 'path') return pathPoints(a.d ?? '');
  if (tag === 'circle') return [[n('cx') - n('r'), n('cy') - n('r')], [n('cx') + n('r'), n('cy') + n('r')]];
  if (tag === 'ellipse') return [[n('cx') - n('rx'), n('cy') - n('ry')], [n('cx') + n('rx'), n('cy') + n('ry')]];
  if (tag === 'rect') return [[n('x'), n('y')], [n('x') + n('width'), n('y') + n('height')]];
  if (tag === 'line') return [[n('x1'), n('y1')], [n('x2'), n('y2')]];
  const nums = (a.points ?? '').match(/-?[\d.]+/g)?.map(Number) ?? [];
  const pts = [];
  for (let k = 0; k + 1 < nums.length; k += 2) pts.push([nums[k], nums[k + 1]]);
  return pts;
}

/** Splits a style block into `{ rules: [{selector, decls}], keyframes: [{name, stops}] }`. */
function parseStyle(css, errors) {
  const rules = [];
  const keyframes = [];
  let rest = css.replace(/\/\*[\s\S]*?\*\//g, '');
  rest = rest.replace(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g, (_, name, body) => {
    const stops = [];
    for (const m of body.matchAll(/([^{}]+)\{([^{}]*)\}/g)) stops.push({ at: m[1].trim(), decls: parseDecls(m[2]) });
    keyframes.push({ name, stops });
    return '';
  });
  rest = rest.replace(/([^{}]+)\{([^{}]*)\}/g, (_, selector, body) => {
    rules.push({ selector: selector.trim(), decls: parseDecls(body) });
    return '';
  });
  if (rest.trim()) errors.push(`style: could not parse "${rest.trim().slice(0, 40)}"`);
  return { rules, keyframes };
}

function parseDecls(body) {
  return body.split(';').map((d) => d.trim()).filter(Boolean).map((d) => {
    const at = d.indexOf(':');
    return { prop: d.slice(0, at).trim(), value: d.slice(at + 1).trim() };
  });
}

const ms = (value) => (value.endsWith('ms') ? parseFloat(value) : parseFloat(value) * 1000);

function readIcon(name) {
  const errors = [];
  const warnings = [];
  const source = readFileSync(join(svgDir, `${name}.svg`), 'utf8').replace(/\r\n/g, '\n').trim();
  if (!source.startsWith(ROOT_TAG)) errors.push('root <svg> tag differs from the required wrapper');
  if (!source.endsWith('</svg>')) errors.push('file does not end with </svg>');
  let inner = source.slice(source.indexOf('>') + 1, source.lastIndexOf('</svg>'));

  let style = { rules: [], keyframes: [] };
  const styleMatch = inner.match(/<style>([\s\S]*?)<\/style>\s*$/);
  if (styleMatch) {
    style = parseStyle(styleMatch[1], errors);
    inner = inner.slice(0, styleMatch.index);
  } else if (/<style/.test(inner)) errors.push('<style> must be one plain block, last in the file');
  else if (!STILL.has(name)) errors.push('no <style> block: every icon carries its own animation');

  const shapes = [];
  const classes = new Set();
  let leftovers = inner;
  for (const m of inner.matchAll(/<([a-zA-Z]+)\b([^<>]*?)\/>/g)) {
    leftovers = leftovers.replace(m[0], '');
    const [, tag, attrText] = m;
    const attrs = parseAttrs(attrText);
    if (!ELEMENTS[tag]) { errors.push(`<${tag}> is not allowed`); continue; }
    for (const key of Object.keys(attrs)) {
      if (!ELEMENTS[tag].includes(key) && !SHARED_ATTRS.includes(key)) errors.push(`<${tag}> attribute ${key} is not allowed`);
    }
    if (attrs.class !== undefined) {
      if (!/^[a-f]$/.test(attrs.class)) errors.push(`class="${attrs.class}" must be one letter a–f`);
      classes.add(attrs.class);
    }
    if (attrs.pathLength !== undefined && attrs.pathLength !== '1') errors.push('pathLength must be 1');
    const filled = attrs.fill !== undefined || attrs.stroke !== undefined;
    if (filled && !(attrs.fill === 'currentColor' && (attrs.stroke ?? 'none') === 'none')) errors.push(`<${tag}> may only override paint as fill="currentColor" stroke="none"`);
    let points = [];
    try { points = elementPoints(tag, attrs); } catch (error) { errors.push(`<${tag}>: ${error.message}`); }
    if (points.some((p) => p.some((v) => typeof v === 'number' && Number.isNaN(v)))) errors.push(`<${tag}> has a coordinate that is not a number`);
    shapes.push({ tag, attrs, points, filled });
  }
  if (leftovers.trim()) errors.push(`unexpected markup: ${leftovers.trim().slice(0, 50)}`);
  if (!shapes.length) errors.push('no shapes');

  // Bounds: ink inside 2 … 14 (control points may wander a little).
  const xs = [], ys = [];
  for (const shape of shapes) for (const [x, y, control] of shape.points) {
    if (control) { if (x < 0 || x > 16 || y < 0 || y > 16) errors.push(`control point ${x},${y} leaves the grid`); continue; }
    xs.push(x); ys.push(y);
    if (x < 1.5 || x > 14.5 || y < 1.5 || y > 14.5) errors.push(`point ${+x.toFixed(2)},${+y.toFixed(2)} is outside the live area (2…14)`);
    else if (x < 2 || x > 14 || y < 2 || y > 14) warnings.push(`point ${+x.toFixed(2)},${+y.toFixed(2)} is outside 2…14`);
  }
  if (xs.length) {
    const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    if (Math.max(w, h) < 8.5) warnings.push(`small: ${w.toFixed(1)} × ${h.toFixed(1)}`);
    if (Math.abs(cx - 8) > 1 || Math.abs(cy - 8) > 1) warnings.push(`off centre: ${cx.toFixed(1)},${cy.toFixed(1)}`);
  }

  // Motion.
  const frameNames = new Set(style.keyframes.map((k) => k.name));
  const usedFrames = new Set();
  for (const rule of style.rules) {
    if (rule.selector !== 'svg' && !/^\.[a-f]$/.test(rule.selector)) errors.push(`selector "${rule.selector}" must be svg or .a–.f`);
    else if (rule.selector !== 'svg' && !classes.has(rule.selector.slice(1))) errors.push(`selector ${rule.selector} matches no element`);
    let animated = false;
    for (const { prop, value } of rule.decls) {
      if (!RULE_PROPS.has(prop)) { errors.push(`${rule.selector}: property ${prop} is not allowed in a rule`); continue; }
      if (prop !== 'animation') continue;
      animated = true;
      if (value.includes(',')) { errors.push(`${rule.selector}: one animation per rule`); continue; }
      const parts = value.replace(/cubic-bezier\([^)]*\)/g, 'ease').split(/\s+/);
      const times = parts.filter((p) => /^[\d.]+m?s$/.test(p)).map(ms);
      const named = parts.filter((p) => frameNames.has(p));
      if (named.length !== 1) errors.push(`${rule.selector}: animation names no keyframes of this icon`);
      else usedFrames.add(named[0]);
      if (!times.length) errors.push(`${rule.selector}: animation has no duration`);
      else if (times.reduce((a, b) => a + b, 0) > 300) errors.push(`${rule.selector}: duration + delay is ${times.reduce((a, b) => a + b, 0)}ms (max 300)`);
      if (/infinite|alternate|\b[2-9]\b/.test(value.replace(/[\d.]+m?s/g, ''))) errors.push(`${rule.selector}: animation plays once`);
    }
    if (!animated) errors.push(`${rule.selector}: rule has no animation`);
  }
  for (const frames of style.keyframes) {
    if (!usedFrames.has(frames.name)) errors.push(`@keyframes ${frames.name} is never used`);
    for (const stop of frames.stops) {
      if (/\bto\b|100%/.test(stop.at)) errors.push(`@keyframes ${frames.name}: no "to" stop — the icon ends as drawn`);
      for (const { prop, value } of stop.decls) {
        if (!KEYFRAME_PROPS.has(prop)) { errors.push(`@keyframes ${frames.name}: property ${prop} is not allowed`); continue; }
        const nums = (value.match(/-?[\d.]+/g) ?? []).map(Number);
        if (prop === 'translate' && nums.some((v) => Math.abs(v) > 2)) errors.push(`@keyframes ${frames.name}: translate moves more than 2px`);
        if (prop === 'scale' && nums.some((v) => v < 0.6 || v > 1.25)) errors.push(`@keyframes ${frames.name}: scale ${value} is out of range`);
        if (prop === 'opacity' && nums.some((v) => v < 0)) errors.push(`@keyframes ${frames.name}: opacity ${value}`);
      }
    }
  }
  if (!STILL.has(name) && styleMatch && !style.rules.length) errors.push('style block has no rules');

  return { name, component: pascal(name), body: inner.trim().replace(/\n\s*/g, ''), style, errors, warnings };
}

// ── Output ───────────────────────────────────────────────────────────────

function scopedCss(icon) {
  const scope = `.ficon-${icon.name}`;
  const rename = (frame) => `ficon-${icon.name}-${frame}`;
  const frames = icon.style.keyframes.map((k) => k.name);
  const still = [];
  const moving = [];
  for (const rule of icon.style.rules) {
    const target = rule.selector === 'svg' ? '' : ` ${rule.selector}`;
    const pivot = rule.decls.filter((d) => d.prop.startsWith('transform-'));
    const play = rule.decls.filter((d) => !d.prop.startsWith('transform-')).map((d) => {
      if (d.prop !== 'animation') return d;
      const value = d.value.split(/\s+/).map((part) => (frames.includes(part) ? rename(part) : part)).join(' ');
      return { prop: d.prop, value };
    });
    const text = (decls) => decls.map((d) => `${d.prop}: ${d.value};`).join(' ');
    if (pivot.length) still.push(`${scope}${target} { ${text(pivot)} }`);
    moving.push(`  ${HOVER} ${scope}:not([class*='animate-'])${target} { ${text(play)} }`);
  }
  const keyframes = icon.style.keyframes.map((k) =>
    `@keyframes ${rename(k.name)} { ${k.stops.map((s) => `${s.at} { ${s.decls.map((d) => `${d.prop}: ${d.value};`).join(' ')} }`).join(' ')} }`);
  return { still, moving, keyframes };
}

function buildCss(icons) {
  const still = [], moving = [], keyframes = [];
  for (const icon of icons) {
    const css = scopedCss(icon);
    still.push(...css.still); moving.push(...css.moving); keyframes.push(...css.keyframes);
  }
  return `/* Generated by scripts/build.mjs from icons/*.svg — do not edit. */
svg.ficon { flex: none; }
svg.ficon :is(.a, .b, .c, .d, .e, .f) { transform-box: fill-box; transform-origin: center; }
${still.join('\n')}

@media (prefers-reduced-motion: no-preference) {
${moving.join('\n')}
}

${keyframes.join('\n')}
`;
}

function componentSource(icon) {
  return `<!-- Generated by scripts/build.mjs from icons/${icon.name}.svg — do not edit. -->
<svelte:options runes={true} namespace="svg" />

<script lang="ts">
  import Icon from '../Icon.svelte';
  import type { IconProps } from '../types';

  let props: IconProps = $props();
</script>

<Icon {...props} glyph="${icon.name}">${icon.body}</Icon>
`;
}

function indexSource(icons) {
  const byComponent = new Set(icons.map((i) => i.component));
  const lines = icons.map((i) => `export { default as ${i.component} } from './generated/${i.component}.svelte';`);
  for (const [alias, target] of Object.entries(ALIASES)) {
    if (byComponent.has(target) && !byComponent.has(alias)) lines.push(`export { default as ${alias} } from './generated/${target}.svelte';`);
  }
  return `// Generated by scripts/build.mjs — do not edit. Add an icon by drawing icons/<name>.svg.
import './generated/icons.css';

export type { Icon, IconProps } from './types';
${lines.sort((a, b) => a.localeCompare(b)).join('\n')}
`;
}

function sheetSource(icons, css) {
  const cell = (icon, size) =>
    `<svg class="ficon ficon-${icon.name}" width="${size}" height="${size}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${icon.body}</svg>`;
  return `<!doctype html><meta charset="utf-8"><title>ficon</title>
<style>
  body { margin: 16px; font: 11px/1.3 system-ui, sans-serif; color: #1b1b1f; background: #fff; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(118px, 1fr)); gap: 6px; }
  button { all: unset; cursor: pointer; display: grid; grid-template-columns: 16px 40px; gap: 10px; align-items: center; padding: 8px; border-radius: 8px; border: 1px solid #0001; }
  button:hover { background: #0000000a; }
  span { grid-column: 1 / -1; color: #555; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .warn { border-color: #d9770688; }
${css}
</style>
<div class="grid">
${icons.map((i) => `<button class="${i.warnings.length ? 'warn' : ''}" title="${i.warnings.join(' · ')}">${cell(i, 16)}${cell(i, 40)}<span>${i.name}</span></button>`).join('\n')}
</div>
`;
}

// ── Main ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const sheetAt = args.includes('--sheet') ? args[args.indexOf('--sheet') + 1] : null;
const quiet = args.includes('--quiet');

const names = readdirSync(svgDir).filter((f) => f.endsWith('.svg')).map((f) => f.slice(0, -4)).sort();
const icons = names.map(readIcon);

let failed = 0;
for (const icon of icons) {
  for (const error of icon.errors) { failed += 1; console.error(`✗ ${icon.name}: ${error}`); }
  if (!quiet) for (const warning of icon.warnings) console.warn(`· ${icon.name}: ${warning}`);
}

const css = buildCss(icons.filter((i) => !i.errors.length));
if (sheetAt) writeFileSync(resolve(sheetAt), sheetSource(icons.filter((i) => !i.errors.length), css));

if (failed) {
  console.error(`\n${failed} error(s) in ${icons.filter((i) => i.errors.length).length} icon(s).`);
  if (!sheetAt || checkOnly) process.exit(1);
}
if (!checkOnly && !failed) {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  for (const icon of icons) writeFileSync(join(outDir, `${icon.component}.svelte`), componentSource(icon));
  writeFileSync(join(outDir, 'icons.css'), css);
  mkdirSync(join(root, 'dist'), { recursive: true });
  writeFileSync(join(root, 'dist/ficon.css'), css);
  writeFileSync(join(iconsDir, 'index.ts'), indexSource(icons));
  console.log(`${icons.length} icons → ${Object.keys(ALIASES).length} aliases, generated/icons.css`);
} else if (!failed) console.log(`${icons.length} icons pass.`);
