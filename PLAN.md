# Ponytail Audit — Cleanup Plan

Findings from the ponytail-audit of `src/main.ts`. Ranked by cut size.
Status: ☐ pending · ✓ done

---

## 1. ☐ Merge parallel editor Maps into one array (`shrink`, ~8 lines)

**Location:** `src/main.ts:804–829`

`editorHints: Map<EasyMDE, HTMLElement>` and `editorInvalid: Map<EasyMDE, boolean>` are two
parallel Maps for exactly 4 known editors. Replace with one array:

```ts
const editors: { mde: EasyMDE; hint: HTMLElement; invalid: boolean }[] = []
```

- `anyHeadingInvalid()` becomes `editors.some(e => e.invalid)`
- `checkHeadings(mde)` finds its entry with `editors.find(e => e.mde === mde)`
- Eliminates the double Map lookup and two module-level Map declarations

---

## 2. ☐ Merge `replaceToken` + `replaceLogo` into one function (`shrink`, ~6 lines)

**Location:** `src/main.ts:169–184`

Both functions find a token and call `.replace(token, value)`. The only difference is
that `replaceToken` HTML-escapes the value and `replaceLogo` does not. Merge:

```ts
function replaceToken(html: string, token: string, value: string, escape = true): string {
  if (!html.includes(token)) throw new Error(`Template token not found: ${token}`)
  return html.replace(token, escape ? escapeHtml(value) : value)
}
```

All existing `replaceToken(...)` call sites work unchanged. The two `replaceLogo` call
sites become `replaceToken(html, '{{LOGO}}', markup, false)`.

---

## 3. ☐ Replace hand-rolled base64 math in `dataUrlBytes` with `atob` (`stdlib`, ~4 lines)

**Location:** `src/main.ts:565–571`

The manual padding calculation can be replaced with:

```ts
function dataUrlBytes(url: string): number {
  const comma = url.indexOf(',')
  return comma === -1 ? 0 : atob(url.slice(comma + 1)).length
}
```

`atob` returns the decoded string; `.length` is the exact byte count. Already available
in every browser this app targets.

---

## 4. ☐ Convert `sampleState()` function to a plain const (`shrink`, ~2 lines)

**Location:** `src/main.ts:108–133`

`sampleState()` is a zero-argument function that returns a new object literal with no
closure over runtime values — it's effectively a constant. Replace:

```ts
const SAMPLE_STATE: Partial<PersistedState> = { ... }
```

Call sites change from `sampleState()` to `SAMPLE_STATE`.

