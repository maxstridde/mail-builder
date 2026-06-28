# Layout Fix — Handoff Instructions for asta-mail-editor

Apply the three layout fixes from mail-builder (PRs #1 and #2) to the
`asta-mail-editor` project. The two codebases are structurally identical in this
area — same CSS class names, same `updatePreview()` function, same two-column
layout. Apply every change verbatim unless the existing code already looks
different, in which case adapt the intent.

---

## Fix 1 — Wide-screen preview panel: `sticky` → `fixed`

**File:** `src/style.css`

### 1a. Panel-left: lock it to half-width

Find the `.panel-left` rule and change the flex shorthand:

```css
/* BEFORE */
.panel-left {
  flex: 1 1 50%;
  min-width: 0;
  ...
}

/* AFTER */
.panel-left {
  /* Stay at half-width even though panel-right is out of normal flow (fixed). */
  flex: 0 0 calc(50% - 8px);
  min-width: 0;
  ...
}
```

### 1b. Panel-right: switch to `fixed`

Replace the entire `.panel-right` rule:

```css
/* BEFORE (roughly) */
.panel-right {
  flex: 1 1 50%;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  position: sticky;
  top: calc(var(--header-height) + 16px);
  height: calc(100vh - var(--header-height) - 32px);
}

/* AFTER */
.panel-right {
  /* Fixed: sits in the viewport's right column and never scrolls.
     Width derivation: (100vw − 32px layout-padding − 16px gap) / 2 = 50vw − 24px.
     For a fixed element, 50% resolves against the viewport, so 50% − 24px = 50vw − 24px. */
  position: fixed;
  top: calc(var(--header-height) + 16px);
  right: 16px;
  width: calc(50% - 24px);
  height: calc(100vh - var(--header-height) - 32px);
  padding: 0;
  overflow: hidden;
  /* Above page content but below the fixed app-header (z-index 10). */
  z-index: 5;
}
```

> **Width derivation:** layout has 16px padding on both sides → usable width =
> `100vw − 32px`. Gap between panels = 16px. Each panel = `(100vw − 32px − 16px) / 2`
> = `50vw − 24px`. For a `position: fixed` element, `50%` resolves against the
> viewport, so `calc(50% − 24px)` is correct.

---

## Fix 2 — Footer: constrain to left column on wide screens

**File:** `src/style.css`

Add this new media query **above** the existing `@media (max-width: 900px)` block:

```css
/* On wide screens the footer sits below the left panel only (the right panel is
   fixed and out of flow). Constrain the footer so it doesn't visually bleed
   into the right-panel area. 50% − 8px mirrors panel-left's flex basis. */
@media (min-width: 900px) {
  .site-footer {
    max-width: calc(50% - 8px);
  }
}
```

---

## Fix 3 — Mobile: restore full-width panels

**File:** `src/style.css`

Find the existing `@media (max-width: 900px)` block and add overrides for both
panels so they stack full-width (the `panel-left` half-width from Fix 1 would
otherwise also apply on mobile):

```css
@media (max-width: 900px) {
  .layout {
    flex-direction: column;
    align-items: stretch;
  }
  /* On narrow screens both panels stack full-width. */
  .panel-left {
    flex: 1 1 auto;
    width: 100%;
  }
  /* The preview joins normal page flow and expands to its full content height
     (set dynamically in main.ts), so the whole email is visible inline. */
  .panel-right {
    position: static;
    width: 100%;
    height: auto;
    overflow: visible;
  }
  #preview {
    height: auto;
  }
}
```

---

## Fix 4 — Mobile iframe shrink bug

**File:** `src/main.ts`

Inside `updatePreview()`, find the `onLoad` handler's mobile branch. It currently
reads `scrollHeight` and sets the iframe height in one step. Replace it so the
iframe is collapsed to `0px` first:

```ts
// BEFORE
const onLoad = () => {
  if (MOBILE_QUERY.matches) {
    const doc = previewIframe.contentWindow?.document
    if (doc) previewIframe.style.height = `${doc.documentElement.scrollHeight}px`
  } else {
    previewIframe.style.height = ''
  }
  ...
}

// AFTER
const onLoad = () => {
  if (MOBILE_QUERY.matches) {
    const doc = previewIframe.contentWindow?.document
    if (doc) {
      // Reset to 0 first: scrollHeight returns max(content, frame), so if the
      // old frame height is larger than the new content the iframe would never
      // shrink. Collapsing to 0 forces scrollHeight == true content height.
      previewIframe.style.height = '0px'
      previewIframe.style.height = `${doc.documentElement.scrollHeight}px`
    }
  } else {
    previewIframe.style.height = ''
  }
  ...
}
```

---

## Checklist before opening the PR

- [ ] Wide screen (≥ 900 px): scrolling the left panel leaves the right preview pinned
- [ ] Wide screen: both panels are the same width
- [ ] Wide screen: site footer appears only below the left column
- [ ] Mobile (< 900 px): both panels span the full screen width
- [ ] Mobile: toggling secondary language off shrinks the preview iframe correctly
- [ ] Mobile: toggling secondary language back on grows it again
- [ ] No regressions in draft export/import, colour picker, logo upload
