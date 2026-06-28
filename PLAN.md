# Layout Fix Plan

## Issues to fix

### 1. Mobile — preview doesn't shrink when content gets shorter

**Root cause:** `scrollHeight` on an `<iframe>` document returns
`max(content_height, frame_height)`. When the user toggles secondary language
off, `updatePreview()` sets a new (shorter) `srcdoc`. The `onLoad` handler
reads `doc.documentElement.scrollHeight` while the iframe still has the old
*explicit* pixel height in its `style` attribute (left there by the previous
call). Because `scrollHeight ≥ frame_height`, the browser reports the old
(larger) height and the iframe stays tall even though the email is shorter.

**Fix — `src/main.ts`, inside `updatePreview()`'s `onLoad` handler:**

Before reading `scrollHeight`, collapse the frame to zero height:

```ts
previewIframe.style.height = '0px'                                 // collapse → scrollHeight = content height
previewIframe.style.height = `${doc.documentElement.scrollHeight}px` // set true height
```

Setting height to `0px` synchronously (the browser performs a layout flush
when `scrollHeight` is subsequently read) means the frame viewport is tiny,
so `scrollHeight` equals the content's natural height, not a leftover frame
height. No visible flash occurs because both assignments happen in the same
JS microtask before paint.

---

### 2. Wide screen — preview panel should be truly fixed (never moves)

**Current behaviour:** `.panel-right` is `position: sticky`. This keeps
it inside the normal flex flow. While the element appears to stick, it will
start to scroll away when the scrollable parent's extent ends — in our case
there is no explicit parent height so it can behave unexpectedly, and more
importantly the user specifically wants the panel to *never* move.

**Fix — `src/style.css`:**

Change `.panel-right` to `position: fixed` and position it explicitly so
it sits exactly where it used to:

```css
.panel-right {
  position: fixed;
  top: calc(var(--header-height) + 16px);   /* same as old `sticky top` */
  right: 16px;                              /* flush with layout's right padding */
  width: calc(50% - 24px);                 /* viewport-relative: 50vw − 24px */
  height: calc(100vh - var(--header-height) - 32px);  /* same as before */
  overflow: hidden;
  padding: 0;
  z-index: 5;  /* above normal content, below fixed .app-header (z-index 10) */
}
```

Width derivation:
- Layout has `padding: 16px` on both sides → available width = `100vw − 32px`
- Gap between panels = `16px`
- Each panel = `(100vw − 32px − 16px) / 2 = 50vw − 24px = calc(50% − 24px)`
  (for a fixed element, `50%` resolves against the viewport, i.e. `50vw`)

Because `.panel-right` is now out of the normal flow, `.panel-left` would
expand to fill the whole layout container. Prevent that:

```css
.panel-left {
  flex: 0 0 calc(50% - 8px);   /* 50% of layout container − half-gap = 50vw − 24px */
  min-width: 0;
}
```

Here `50%` is relative to the flex container (`100vw − 32px` layout padding),
so `calc(50% − 8px) = 50vw − 16px − 8px = 50vw − 24px`. Both panels end up
the same width.

The `.panel` class already provides `background: #fff; border: 1px solid
var(--border); border-radius: 8px`, so the fixed panel looks right without
extra declarations.

---

### 3. Footer — should appear only below the left editor column

**Why this follows from fix #2 for free:**

With `.panel-right` as `position: fixed`, it leaves the normal document flow.
The `.layout` flex container now only contains `.panel-left`. Its height
equals the left panel's content height. The `<footer class="site-footer">`
sits after `.layout` in the HTML, so it naturally appears below the left
column only — no HTML changes needed.

The fixed right panel overlaps the right half of the viewport at z-index 5.
If the left column is very short (footer scrolls into view while the fixed
panel is still visible), the footer text's right portion would fall behind
the panel. To keep things clean, constrain the footer to the left column
width on wide screens:

```css
@media (min-width: 900px) {
  .site-footer {
    max-width: calc(50% - 8px);   /* mirror panel-left width in layout container */
  }
}
```

(On mobile the footer keeps its current full-width centered style.)

---

## Files changed

| File | Change |
|---|---|
| `src/style.css` | `.panel-right`: `sticky` → `fixed` + right/width; `.panel-left`: `flex: 0 0 calc(50% - 8px)`; footer max-width on wide screens |
| `src/main.ts` | `onLoad` handler: reset iframe height to `0px` before reading `scrollHeight` |

## Mobile breakpoint (< 900 px)

No structural changes. The existing media-query rules (`position: static;
height: auto`) still apply to both panels. Only the `onLoad` height-reset
(fix #1) touches mobile behaviour.

## What stays the same

- Fixed `.app-header` at z-index 10 — unchanged
- `--header-height` CSS variable as the single source of truth — unchanged
- EasyMDE editors, ToC lists, all input handling — unchanged
- Draft export/import, localStorage persistence — unchanged
- Preview scroll-position restore logic — unchanged
