#!/usr/bin/env node
/**
 * Smoke test for the generated React and Vue packages.
 *
 *   npm i --no-save react react-dom vue typescript @types/react
 *   node scripts/smoke.mjs
 *
 * Renders every icon with react-dom/server and vue/server-renderer, then type-checks
 * scripts/smoke-types.tsx against ficon/react and ficon/vue with `tsc --noEmit --strict`.
 * Installs nothing itself.
 */
import { register, createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The packages import '../dist/ficon.css' for bundlers; Node gets an empty module instead.
register(
  'data:text/javascript,' +
    encodeURIComponent(
      "export async function load(url, context, next) { return url.endsWith('.css') ? { format: 'module', source: '', shortCircuit: true } : next(url, context); }",
    ),
);

let failures = 0;
const fail = (message) => { failures += 1; console.error(`✗ ${message}`); };

/** Every export of a package that is an icon (aliases included). */
const iconsOf = (mod) => Object.entries(mod).filter(([, value]) => typeof value === 'function' || typeof value === 'object');

/** Checks one rendered icon. */
function expectIcon(framework, name, html, glyph) {
  if (!html.startsWith('<svg')) return fail(`${framework} ${name}: does not render an <svg>`);
  if (!html.includes('viewBox="0 0 16 16"')) fail(`${framework} ${name}: viewBox is not 0 0 16 16`);
  if (!html.includes('ficon ')) fail(`${framework} ${name}: no ficon class`);
  if (glyph && !html.includes(`ficon-${glyph}`)) fail(`${framework} ${name}: no ficon-${glyph} class`);
  if (!/<(path|circle|rect|line|polyline|ellipse)\b/.test(html)) fail(`${framework} ${name}: no shapes`);
}

// ── React ────────────────────────────────────────────────────────────────
{
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const icons = await import('ficon/react');
  const list = iconsOf(icons);
  for (const [name, Icon] of list) expectIcon('react', name, renderToStaticMarkup(createElement(Icon)));

  const html = renderToStaticMarkup(createElement(icons.Check, { size: 16, weight: 'slim', className: 'size-4', 'aria-label': 'Done' }));
  expectIcon('react', 'Check', html, 'check');
  for (const part of ['width="16"', 'ficon-slim', 'size-4', 'aria-label="Done"']) if (!html.includes(part)) fail(`react Check props: missing ${part} in ${html}`);
  if (html.includes('aria-hidden')) fail('react Check: labelled icon is still aria-hidden');
  if (!renderToStaticMarkup(createElement(icons.Lock, { strokeWidth: 1 })).includes('--ficon-stroke:1')) fail('react Lock: strokeWidth does not set --ficon-stroke');
  if (icons.AlertCircle !== icons.CircleAlert) fail('react: alias AlertCircle is not CircleAlert');
  console.log(`react: ${list.length} icons render`);
}

// ── Vue ──────────────────────────────────────────────────────────────────
{
  const { createSSRApp, h } = await import('vue');
  const { renderToString } = await import('vue/server-renderer');
  const icons = await import('ficon/vue');
  const render = (node) => renderToString(createSSRApp({ render: () => node }));
  const list = iconsOf(icons);
  for (const [name, Icon] of list) expectIcon('vue', name, await render(h(Icon)));

  const html = await render(h(icons.Check, { size: 16, weight: 'slim', class: 'size-4', 'aria-label': 'Done' }));
  expectIcon('vue', 'Check', html, 'check');
  for (const part of ['width="16"', 'ficon-slim', 'size-4', 'aria-label="Done"']) if (!html.includes(part)) fail(`vue Check props: missing ${part} in ${html}`);
  if (html.includes('aria-hidden')) fail('vue Check: labelled icon is still aria-hidden');
  if (!(await render(h(icons.Lock, { strokeWidth: 1 }))).includes('--ficon-stroke:1')) fail('vue Lock: strokeWidth does not set --ficon-stroke');
  console.log(`vue: ${list.length} icons render`);
}

// ── Types ────────────────────────────────────────────────────────────────
{
  const tsPackage = createRequire(join(root, 'package.json')).resolve('typescript/package.json');
  const tsc = join(dirname(tsPackage), 'bin/tsc');
  try {
    execFileSync(process.execPath, [
      tsc, '--noEmit', '--strict',
      '--jsx', 'react-jsx', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--target', 'es2022',
      join(root, 'scripts/smoke-types.tsx'),
    ], { cwd: root, stdio: 'inherit' });
    console.log('types: ficon/react and ficon/vue check under --strict');
  } catch {
    fail('tsc reported errors in scripts/smoke-types.tsx');
  }
}

if (failures) {
  console.error(`\n${failures} smoke failure(s).`);
  process.exit(1);
}
console.log('smoke test passed.');
