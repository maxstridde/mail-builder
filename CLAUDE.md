# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mail Builder — a general-purpose, free, browser-based HTML email/newsletter
builder. A user writes newsletter content in Markdown and gets a ready-to-copy
HTML email built from a clean, email-client-safe template. Aimed at anyone
sending newsletters (teachers, small shops, clubs, community groups). No
backend, no framework, no accounts — everything runs client-side and persists to
`localStorage`.

> **Status: generic rebuild complete.** This repository began as an
> AStA-Uni-Bonn-specific builder and has been converted into this generic tool.
> `CLAUDE.md` describes the current architecture.

## Deployment target

GitHub Pages, deployed automatically via GitHub Actions on every push to `main`.
Build output is `dist/`. Repo: `https://github.com/maxstridde/mail-builder`.
Pages base path: `/mail-builder/`.

## Project structure

```
mail-builder/
├── index.html                   # Vite entry point + builder UI markup
├── src/
│   ├── main.ts                  # all app logic
│   ├── style.css                # builder UI styles
│   ├── template.html            # the email template (imported as ?raw)
│   └── vite-env.d.ts            # types for the build-time define constants
├── vite.config.ts
├── tsconfig.json
├── package.json
├── README.md
├── social-preview/             # OG image + demo GIF tooling
└── .github/workflows/deploy.yml
```

## npm dependencies

```json
{
  "dependencies": {
    "easymde": "latest",
    "marked": "^12.0.0",
    "wcag-contrast": "latest"
  },
  "devDependencies": {
    "vite": "latest",
    "typescript": "latest"
  }
}
```

`wcag-contrast` provides the contrast-ratio calculation for the accent-color
checker (we do not hand-roll the WCAG luminance math).

Imports in `src/main.ts`:
```ts
import EasyMDE from 'easymde'
import { marked } from 'marked'
import { hex as contrastRatio } from 'wcag-contrast'
import 'easymde/dist/easymde.min.css'
import templateHtml from './template.html?raw'
import './style.css'
```

## Vite config

```ts
// vite.config.ts
const base = '/mail-builder/'
export default defineConfig({
  base,
  define: {
    __APP_CREATED__: JSON.stringify('…'),
    __APP_AUTHOR__: JSON.stringify('…'),
    __APP_CONTACT_EMAIL__: JSON.stringify('…'),
    // public/LICENSE.txt is emitted to the dist root, served at <base>LICENSE.txt
    __APP_LICENSE_URL__: JSON.stringify(base + 'LICENSE.txt'),
  },
})
```

The `define` constants feed the site-footer attribution note (see below). They
are generic + the maintainer's contact and are the only place attribution is
configured. The license link points at `public/LICENSE.txt` (a copy of the
repo-root `LICENSE`), which Vite emits to `dist/` so the deployed footer link
resolves instead of 404ing.

## Two-language model (generic, user-named)

The builder edits content in **two languages side by side** (a "primary" and a
"secondary"), but it is **language-agnostic**:

- The two language **names are user-editable** (`lang1Name`, `lang2Name`,
  defaults `"German"` / `"English"`). They are stored in state, persisted to
  localStorage, and travel in the exported draft JSON.
- Every paired section shows a live **language tag** — `${langName} — <Section>`
  (e.g. `German — Introduction`) — that updates immediately when the user renames
  a language. This replaces the old fixed `DE` / `EN` tags.
- The **secondary language has an On/Off toggle** (`secondaryEnabled`). When off,
  every `.secondary-only` element is hidden and the secondary block (plus its
  divider) is dropped from the assembled output without clearing the underlying
  field values. The toggle button label is dynamic: `${lang2Name}: On/Off`.
- A "secondary-language notice" field (default `"english version below"`) renders
  above the primary title, only when the secondary language is enabled.

Internal field keys use the `lang1*` / `lang2*` prefixes (primary / secondary).

## Page layout

Two-column layout: left panel = all inputs, right panel = live preview iframe.
Stack vertically on screens < 900 px (the mobile layout sets
`align-items: stretch` on `.layout` so panels fill the full width).

The `.app-header` is `position: fixed` (full width, `z-index: 10`) on all screen
sizes; its height comes from the `--header-height` CSS variable (`:root`,
currently `48px`), the single source of truth feeding both the `.layout` top
padding offset and the `.panel-right` sticky `top` / `height` calc()s.

On wide screens (≥ 900 px) the preview is `position: sticky` and fills the
viewport below the fixed header with its own scrollbar. On narrow screens the
preview rejoins normal page flow and `updatePreview()` sizes the iframe to its
full content height.

A muted `.site-footer` note sits at the bottom of normal document flow.

**Left panel structure (top to bottom):**
- Copy HTML + Export + Reset/Clear-all buttons (top)
- "How does this work?" collapsible (see below) + Markdown instructions block
  (H2/H3-only rule, link syntax)
- **Appearance** controls: language-name inputs (×2), accent-color picker + hex
  input + preset palette swatches + contrast badge, logo import + "Remove logo"
- Secondary-language On/Off toggle + Export Draft + Import Draft +
  "Load sample newsletter" buttons, the hidden file inputs, and a transient
  `#draft-feedback` message line
- Greeting section (Title, secondary-language notice, Greeting) — `<details>`,
  collapsed by default
- Introduction section (primary + secondary paired)
- Table of Contents section (paired, incl. editable ToC title)
- Main Text section (paired)
- Final Greeting section (paired) — `<details>`, collapsed
- Footer section (not language-paired) — `<details>`, collapsed
- Copy HTML + Export buttons (bottom) + Reset / Clear all (bottom)

**Pairing rule:** primary and secondary fields for the same content type are
grouped in the same visual section, primary above secondary, each carrying a
live `${langName} — <Section>` tag. Every secondary-side element carries the
`secondary-only` class so the toggle can show/hide it in one pass.

## Input fields

| Field | Widget | Notes |
|---|---|---|
| Language names (×2) | `<input type="text">` | `German` / `English`; drive the live section tags + toggle label |
| Accent color | `<input type="color">` + hex `<input>` + palette swatches | `accentColor` (default neutral accent). Threaded into the template + postProcess at assembly. Contrast badge shows WCAG ratio. |
| Logo image | `<input type="file" accept="image/*">` + Use-sample / Remove buttons | Read as base64 data URL, size-guarded, stored in `logoDataUrl` (the original). "Use sample logo" fetches the bundled `public/riverside-community-center-white.svg` |
| Logo recolor | None/White/Black buttons + custom `<input type="color">` | `logoRecolor` ('' = original, else a hex). Tints the logo to one color via canvas `source-in` (alpha shape kept), re-exported as PNG into `logoRenderUrl`. Shows the embedded size + a Download button. Tools block is hidden when no image is set |
| Logo text | `<input type="text">` | `logoText`; fallback wordmark shown when no image is set. Empty + no image = no logo at all |
| Title (×2) | `<input type="text">` | the `<h1>` text per language |
| Secondary-language notice | `<input type="text">` | shown above primary title when secondary enabled |
| Greeting (×2) | `<input type="text">` | **single** plain-text greeting per language (no Sympa/merge logic baked in — type your own if needed) |
| Introduction (×2) | EasyMDE | Markdown |
| ToC title (×2) | `<input type="text">` | the ToC box `<h4>` |
| ToC items (×2) | dynamic list of `<input type="text">` | `+ Add item` / `− Remove` per row; `TOC_DEFAULT_COUNT` (3) rows by default |
| Main Text (×2) | EasyMDE | Markdown |
| Final Greeting (×2, 2 lines each) | `<input type="text">` × 2 per language | plain text |
| Footer address | `<textarea rows="3">` | plain text; `\n`→`<br>` at assembly, not Markdown |
| Footer email text/href | `<input>` × 2 | |
| Footer list-link text/href | `<input>` × 2 | |
| Footer unsubscribe lead / link text / link href | `<input>` × 3 | |
| Secondary On/Off toggle | `<button id="toggle-secondary">` | default on |

EasyMDE editors use a restricted toolbar (`EDITOR_TOOLBAR_OPTIONS`) that omits
`image` and `check-list`. Each of the 4 editors runs a debounced (700 ms)
heading check: an H1 (`#`) or H4–H6 anywhere outlines the editor yellow
(`heading-warning`), since only H2/H3 are valid in the body (H1 = title). When
an editor is in the warning state it also shows a yellow `.heading-hint` line
directly below it explaining the rule. While **any** editor is invalid, the four
Copy/Export buttons get a yellow `.has-warning` style, and clicking them runs
`confirmDespiteWarnings()` — an advisory `confirm()` the user can dismiss to
proceed anyway. The check also runs once at startup over restored/sample
content (not just on later keystrokes).

## Greeting (no Sympa)

The greeting is a single editable text field per language, assembled as a plain
escaped `<p>`. There is **no** Sympa `[% IF user.gecos %]…` conditional — it was
removed in the generic rebuild. Users who want per-recipient merge tags type
their mailing tool's syntax directly into the field; the builder passes it
through verbatim (escaped) without special handling.

## Accent color & contrast

- `template.html` uses a `{{ACCENT}}` token everywhere the brand color appears
  (the `<style>` block and inline styles: header `bgcolor`, h1, h4, `.main a`,
  `.main-link`). `assembleHtml` swaps in `state.accentColor` via `replaceToken`.
- `postProcess(html, accent)` injects the accent color into dynamically rendered
  `<a>`, `<h2>`, `<h3>` inline styles (email clients strip `<style>`).
- The UI offers a color picker + hex input (kept in sync) + a small set of
  preset palette swatches.
- The contrast badge uses `wcag-contrast`'s `hex()` to show the ratio of the
  accent against the white content background and against white header text,
  with an AA pass/fail indicator and a note that contrast must be maintained for
  readability. It **warns**, it does not block.

## Logo

- `template.html` has a `{{LOGO}}` injection point in the header. `buildLogo`
  resolves it in priority order:
  1. image set → an `<img>` **wrapped in a `width="300"` table**
     (Thunderbird strips `max-width` off a bare `<img>`; the HTML `width`
     attribute on a wrapper table is respected, and the image fills it at
     `width:100%`).
  2. else `logoText` non-empty → a white wordmark `<div>` (escaped).
  3. else → nothing (an empty header bar, no logo and no text).
- On file select: `FileReader.readAsDataURL`; imports are **accepted up to
  100 KB** and rejected above that with an inline message; otherwise stored in
  `logoDataUrl`, persisted, and previewed. "Remove image" clears the logo (the
  `logoText` fallback, if any, then shows). A "Use sample logo" button fetches
  the bundled `public/riverside-community-center-white.svg`.
- **Original vs render URL:** `logoDataUrl` holds the *original* import;
  `logoRecolor` ('' or a hex) and `logoRenderUrl` (the image actually embedded)
  are module-level. `refreshLogo()` recomputes `logoRenderUrl` asynchronously
  (recolor → canvas → PNG) then calls `updatePreview()`; `assembleHtml` embeds
  `logoRenderUrl || logoDataUrl`. Only `logoDataUrl` + `logoRecolor` are
  persisted — the render URL is recomputed on load.
- **Recolor** (`recolorImage`): draw the image, then `globalCompositeOperation =
  'source-in'` paints the chosen color only over opaque pixels (alpha shape
  kept), re-exported as PNG (more email-safe than SVG). White logos on the
  accent-colored header bar look best — the UI says so.
- A size readout (`dataUrlBytes`/`formatBytes`) shows the embedded image size and
  a Download button (`downloadLogo`) saves the current `logoRenderUrl`. The whole
  tools block is hidden until an image is loaded.
- The UI **advises users to aim for ~20 KB** logos to keep emails small (a hint
  by the import control, the live size readout, plus a soft note when an accepted
  logo is well over ~20 KB).
- The base64 logo is part of persisted state and the draft JSON — hence the size
  guard, to keep localStorage and draft files reasonable.

## Template injection

`src/template.html` is imported as a raw string. `assembleHtml(state)`:

1. If the secondary language is disabled, strips two regions via plain
   indexOf/slice (`stripRegion()`) before other replacement:
   - `<!-- EDIT SecondaryNotice -->` … `<!-- SecondaryNotice End -->`
   - `<!-- SECONDARY BLOCK START -->` … `<!-- SECONDARY BLOCK END -->` (divider +
     entire secondary content section). If enabled, those go through normal
     `replaceSection` calls instead.
2. `replaceSection(html, startMarker, endMarker, newContent)` once per
   comment-delimited region, in document order: primary Title, Greeting,
   Introduction, ToC title, ToC list, Main Content, Final Greeting 1/2; then —
   only when secondary enabled — the secondary equivalents; then the footer
   fields.
3. `replaceToken(html, token, value)` for values that can't carry an HTML comment:
   `{{ACCENT}}` (accent color, replaced globally), `{{LOGO}}` (logo markup), and
   the three footer href attributes (`{{FOOTER_EMAIL_HREF}}`,
   `{{FOOTER_MAILINGLIST_HREF}}`, `{{FOOTER_UNSUBSCRIBE_HREF}}`).

Marker naming: `<!-- EDIT <Name> -->` … `<!-- EDIT -->` (placeholder) …
`<!-- <Name> End -->`. Secondary-side markers get a distinct name (e.g.
`Title2`, `TocTitle2`).

## CSS post-processing

Inline styles are required on dynamically injected Markdown (email clients strip
`<style>`):

```ts
function postProcess(html: string, accent: string): string {
  return html
    .replace(/<a /g, `<a style="color:${accent}; text-decoration:none;" `)
    .replace(/<ol>/g, '<ol style="margin-top:0; padding-left:20px;">')
    .replace(/<ul>/g, '<ul style="margin-top:0; padding-left:20px;">')
    .replace(/<h2>/g, `<h2 style="font-size:24px; color:${accent}; margin-bottom:5px;">`)
    .replace(/<h3>/g, `<h3 style="font-size:18px; color:${accent}; margin-bottom:5px;">`)
}
```

## Live preview

`previewIframe.srcdoc = assembledHtml`. Updates on every EasyMDE `change` and
every `input` on plain text fields, debounced 200 ms. Scroll position is
captured before the srcdoc swap and restored via a single one-time `load`
handler (`pendingPreviewLoad`), which also does the mobile dynamic-height resize.
`MOBILE_QUERY`'s `change` re-runs `updatePreview()` across the 900 px breakpoint.

## Buttons

- **Copy HTML** / **Export .html** — clipboard / `Blob` download (`newsletter.html`).
- **Export Draft** — `collectState()` → pretty JSON (`newsletter-draft.json`).
- **Import Draft** — file picker → `JSON.parse` → `applyState({ ...defaultState(), ...parsed })` → `updatePreview()`; parse failures show a transient `#draft-feedback` error.
- **Load sample newsletter** — `applyState({ ...defaultState(), ...sampleState() })` to fill a realistic fictional sample, then `updatePreview()`.
- **Reset / Clear all** — `confirm()` → clear editors/inputs, reset ToC rows, remove localStorage.
- **Secondary On/Off** — flips `secondaryEnabled`, toggles `.secondary-only` display, updates its label, triggers preview.

## "How does this work" section

A collapsible `<details>` in the left panel explaining how to send the generated
HTML. Covers: what the tool does; **Thunderbird in depth** (compose ▸ Insert ▸
HTML… ▸ paste ▸ **delete the trailing empty line/signature artifact** Thunderbird
adds below the pasted email ▸ send); and **brief notes for Gmail/Outlook/other
clients** (most webmail doesn't accept raw HTML paste — paste the rendered email
or use the exported `.html`).

## Site footer note

`.site-footer` (`#site-footer-note`) built in `renderSiteFooterNote()` from four
build-time constants in `vite.config.ts`'s `define`: `__APP_CREATED__`,
`__APP_AUTHOR__`, `__APP_CONTACT_EMAIL__`, `__APP_LICENSE_URL__` (typed in
`src/vite-env.d.ts`). Wording is generic (no AStA reference). Edit only those
four values to update attribution.

## LocalStorage

Save all field values (including `lang1Name`, `lang2Name`, `accentColor`,
`logoDataUrl`, `logoText`, `secondaryEnabled`) on every change (debounced). Key:
`mail-builder`. On load, restore saved values if present (merged over defaults);
otherwise initialize with generic Acme-style defaults.

## Default accent color

A neutral, accessible default (e.g. `#2563EB`) — defined in `defaultState()` and
mirrored in the template's `{{ACCENT}}` fallback / social tooling. Used for
links, h1–h4 headings, and the header bar.

## What NOT to build

- No backend, API calls, or server
- No user accounts or saved sessions
- No image **hosting** (logo is base64-embedded into the email at export)
- No React, Vue, or Angular — vanilla TypeScript only
- Do not re-introduce AStA/Sympa-specific logic or branding
