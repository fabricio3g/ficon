# Contributing an icon

Draw `icons/<name>.svg`, run `npm run build`, and look at it in `index.html` at 16px before opening a pull request. The build refuses a file that breaks the rules below.

## Drawing rules

Every file is exactly this wrapper around the shapes:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
  <path d="…"/>
</svg>
```

1. **Grid**: 16 × 16. Coordinates sit on the half-pixel grid (`3`, `3.5`, `4`);
   quarter steps only where a diagonal or an optical correction needs them.
   Arc radii are free.
2. **Live area**: stroke centres stay inside 2 … 14 on both axes.
3. **Optical size**: icons weigh the same, they do not measure the same. A
   circle is `r="6"` at `8,8`; a square is 9–10 across (`x=3.5 … 12.5`),
   because a square that touched 2 and 14 would look bigger than the circle;
   a wide rectangle (screen, card, mail) is 12 × 9; a tall one (phone, page)
   9 × 12. Plain strokes (`plus`, `minus`, arrows) run 3.5 … 12.5.
4. **Stroke only**: one weight, `1.5`, set on the root. No fills, except a dot
   too small to be an outline: `<circle r=".85" fill="currentColor"
   stroke="none"/>`.
5. **Air**: two parallel strokes keep their centres at least 3 apart, so a
   clear 1.5 gap shows between them. A detail that cannot keep that distance
   is dropped, never squeezed in. At 16px an icon carries one idea: two to
   four strokes, rarely six. Compare `trash-2` here with any 24px set: no
   ribs, because they would close up.
6. **Corners**: containers are rounded `1.5`. Inner detail may be sharp —
   joins are round anyway.
7. **Angles**: diagonals at 45° wherever the metaphor allows. Chevrons and
   arrow heads are 3.5 deep and 7 across (`chevron-right`, `arrow-right`).
8. **Elements**: `path`, `circle`, `rect`, `line`, `polyline`, `ellipse` only.
   No `g`, `transform`, `id`, `text`, `defs`, gradients or per-element stroke
   attributes.
9. **Families share a skeleton**. Every `file-*` icon is `file.svg` plus one
   small mark in the body (x 5.5 … 10.5, y 7.5 … 12). Every `folder-*` is
   `folder.svg` plus a mark. Every `circle-*` is the `r="6"` circle, every
   `square-*` and `panel-*` the same frame, every `message-square-*` the same
   bubble. Mirrored pairs are exact mirrors.
10. **Recognisable first**. Keep the metaphor people already know for the
    name and simplify it until it reads at 16px. Look at the drawing at 16px
    before calling it done: if two strokes merge into a blob there, remove one.

## Motion

Every icon owns its animation: a `<style>` block, last child of the file,
that says what the icon does when the control it sits in is hovered. No two
icons share a rule — the trash can lifts its lid, the check draws itself, the
bell swings. `loader-circle` is the one icon with none (it spins while shown).

```svg
<svg …>
  <path class="a" d="M2.5 4.5h11M6 4.5V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5"/>
  <path d="M4 4.5l.5 8…"/>
  <style>
    .a { transform-box: view-box; transform-origin: 13.5px 4.5px; animation: lid 280ms ease-out; }
    @keyframes lid { 45% { rotate: 14deg; translate: 0 -1px; } }
  </style>
</svg>
```

1. **Selectors**: `svg` (the whole icon) or one part class, `.a` … `.f`, put on
   the elements that move (several elements may share a class). One selector
   per rule, no lists, no nesting, no pseudo-classes.
2. **A rule** holds `animation: <keyframes> <duration> <easing> [<delay>]` and
   nothing else, except `transform-origin` / `transform-box` when the pivot is
   not the part's own centre, and `stroke-dasharray: 1` for a draw-on.
3. **Pivot**: a part scales and rotates about its own centre by default
   (`transform-origin: 100% 0%` moves it within the part's box). To pivot on
   a point of the grid write `transform-box: view-box; transform-origin: 8px 8px;`.
   `svg` always pivots on the icon's centre.
4. **Keyframes** use only `translate`, `rotate`, `scale`, `opacity` and
   `stroke-dashoffset`. They start or end at rest: give middle stops (`50%`)
   for a there-and-back move, or only `from` for an entrance. Never a `to`.
5. **Small and quick**: duration plus delay never exceeds 300ms; 200–280ms is
   the norm. `translate` moves at most 2px, `scale` stays within 0.85–1.15
   (never from 0), `opacity` never starts below 0.3. Easing is `ease-out`, or
   `ease-in-out` for a move that swings both ways.
6. **Draw-on**: give the element `pathLength="1"`, and the rule
   `stroke-dasharray: 1; animation: draw 260ms ease-out;` with
   `@keyframes draw { from { stroke-dashoffset: 1; } }` (see `check`). One
   subpath per drawn-on element.
7. **Meaning over decoration**: the motion says what the icon does — an arrow
   travels its own way, a lid opens, a lens scans, a page turns its corner.
   Move the one part that carries the idea and leave the rest still.
8. The animation plays once per hover. `prefers-reduced-motion` turns all of it off; an icon that already carries a
   utility animation (`animate-spin`) is left alone.

The generator scopes each block to its icon (`.ficon-trash-2 .a`, keyframes
`ficon-trash-2-lid`) and writes them to `dist/ficon.css`.

Anchors that define the look: `plus`, `x`, `check`, `chevron-right`,
`arrow-right`, `arrow-up`, `mic`, `search`, `file`, `folder`, `circle-alert`,
`trash-2`, `copy`, `square`, `play`, `ellipsis`.
