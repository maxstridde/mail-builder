import EasyMDE from 'easymde'
import { marked } from 'marked'
import { hex as contrastRatio } from 'wcag-contrast'
import 'easymde/dist/easymde.min.css'
import templateHtml from './template.html?raw'
import './style.css'

const STORAGE_KEY = 'mail-builder'
const LOGO_MAX_BYTES = 100 * 1024 // hard cap — see CLAUDE.md
const LOGO_ADVISE_BYTES = 20 * 1024 // soft "keep it small" advice threshold
const DEFAULT_ACCENT = '#2563EB'

// Accessible accent presets — each clears WCAG AA (>= 4.5:1) against white, so
// links/headings stay readable on the white content background.
const ACCENT_PALETTE = [
  '#2563EB', '#0F766E', '#047857', '#B91C1C',
  '#BE185D', '#6D28D9', '#B45309', '#1F2937',
]

// Buttons intentionally excluded from the editor toolbar: 'image' (no image
// uploads in the body — only the header logo is embedded) and 'check-list'
// (not useful in email markdown). To restore either, add the name back here —
// see EasyMDE's toolbarBuiltInButtons for the full default order.
const EDITOR_TOOLBAR_OPTIONS = [
  'bold', 'italic', 'strikethrough', 'heading', '|',
  'quote', 'unordered-list', 'ordered-list', '|',
  'link', '|',
  'preview', 'side-by-side', 'fullscreen', '|',
  'guide',
] as const

interface PersistedState {
  lang1Name: string
  lang2Name: string
  accentColor: string
  logoDataUrl: string
  logoRecolor: string
  logoText: string
  secondaryEnabled: boolean
  secondaryNotice: string
  lang1Title: string
  lang2Title: string
  lang1Greeting: string
  lang2Greeting: string
  lang1Intro: string
  lang2Intro: string
  lang1TocTitle: string
  lang2TocTitle: string
  lang1Toc: string[]
  lang2Toc: string[]
  lang1Main: string
  lang2Main: string
  lang1FinalGreeting1: string
  lang1FinalGreeting2: string
  lang2FinalGreeting1: string
  lang2FinalGreeting2: string
  footerAddress: string
  footerEmailText: string
  footerEmailHref: string
  footerMailinglistText: string
  footerMailinglistHref: string
  footerUnsubscribeText: string
  footerUnsubscribeLinkText: string
  footerUnsubscribeLinkHref: string
}

function defaultState(): PersistedState {
  return {
    lang1Name: 'German',
    lang2Name: 'English',
    accentColor: DEFAULT_ACCENT,
    logoDataUrl: '',
    logoRecolor: '',
    logoText: 'Your Organization',
    secondaryEnabled: true,
    secondaryNotice: 'english version below',
    lang1Title: 'Newsletter-Titel',
    lang2Title: 'Newsletter Title',
    lang1Greeting: 'Hallo,',
    lang2Greeting: 'Hello,',
    lang1Intro:
      'Willkommen zu unserem Newsletter. Mehr Infos findest du auf [example.com](https://example.com).',
    lang2Intro:
      'Welcome to our newsletter. Find out more at [example.com](https://example.com).',
    lang1TocTitle: 'In dieser Ausgabe',
    lang2TocTitle: 'In this issue',
    lang1Toc: ['Erstes Thema', 'Zweites Thema', 'Drittes Thema'],
    lang2Toc: ['First topic', 'Second topic', 'Third topic'],
    lang1Main: '',
    lang2Main: '',
    lang1FinalGreeting1: 'Beste Grüße,',
    lang1FinalGreeting2: 'Dein Team',
    lang2FinalGreeting1: 'Best wishes,',
    lang2FinalGreeting2: 'Your team',
    footerAddress: 'Your Organization\nStreet 1, 12345 City',
    footerEmailText: 'hello@example.com',
    footerEmailHref: 'mailto:hello@example.com',
    footerMailinglistText: 'Visit our website',
    footerMailinglistHref: 'https://example.com',
    footerUnsubscribeText: 'To unsubscribe, send an empty email to',
    footerUnsubscribeLinkText: 'unsubscribe@example.com',
    footerUnsubscribeLinkHref: 'mailto:unsubscribe@example.com',
  }
}

// A realistic fictional sample (single-language) for the "Load sample" button,
// shown to demonstrate a finished newsletter out of the box.
const SAMPLE_STATE: Partial<PersistedState> = {
  lang1Name: 'English',
  secondaryEnabled: false,
  accentColor: '#0F766E',
  logoText: 'Riverside Community Center',
  lang1Title: 'Riverside Community Center — June Update',
  lang1Greeting: 'Hi neighbors,',
  lang1Intro:
    "Summer is here and we've got a packed month ahead — new classes, the community garden opening, and our annual block party. Read on for the highlights, and visit [our calendar](https://example.com) for everything else.",
  lang1TocTitle: 'In this issue',
  lang1Toc: ['Community garden opening', 'New summer classes', 'Annual block party'],
  lang1Main:
    '## Community garden opening\n\nOur garden beds are ready! Join us **Saturday, June 7 at 10:00** for the opening. Bring gloves — tools and seedlings are provided.\n\n## New summer classes\n\nRegistration is now open for:\n\n- Beginner pottery (Tuesdays)\n- Conversational Spanish (Wednesdays)\n- Family yoga (Sundays)\n\n[Sign up here](https://example.com).\n\n## Annual block party\n\nSave the date: **June 28, 4–8 pm** on Maple Street. Food, music, and games for all ages. Volunteers welcome — just reply to this email.',
  lang1FinalGreeting1: 'See you around the center,',
  lang1FinalGreeting2: 'The Riverside Community Center team',
  footerAddress: 'Riverside Community Center\n42 Maple Street, Riverside',
  footerEmailText: 'hello@riverside-cc.example',
  footerEmailHref: 'mailto:hello@riverside-cc.example',
  footerMailinglistText: 'Visit our website',
  footerMailinglistHref: 'https://example.com',
  footerUnsubscribeText: 'To stop receiving these emails, email us at',
  footerUnsubscribeLinkText: 'unsubscribe@riverside-cc.example',
  footerUnsubscribeLinkHref: 'mailto:unsubscribe@riverside-cc.example',
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const EDIT_PLACEHOLDER = '<!-- EDIT -->'

// Replace the single `<!-- EDIT -->` placeholder that sits between a region's
// start and end markers. Every editable region in template.html follows the
// `<!-- EDIT Name --> … <!-- EDIT --> … <!-- Name End -->` shape.
function replaceSection(
  html: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startIdx = html.indexOf(startMarker)
  if (startIdx === -1) throw new Error(`Template marker not found: ${startMarker}`)
  const afterStart = startIdx + startMarker.length
  const endIdx = html.indexOf(endMarker, afterStart)
  if (endIdx === -1) throw new Error(`Template marker not found: ${endMarker}`)
  const placeholderIdx = html.indexOf(EDIT_PLACEHOLDER, afterStart)
  if (placeholderIdx === -1 || placeholderIdx > endIdx) {
    throw new Error(`Edit placeholder not found in region: ${startMarker}`)
  }
  return (
    html.slice(0, placeholderIdx) +
    newContent +
    html.slice(placeholderIdx + EDIT_PLACEHOLDER.length)
  )
}

// escape=true (default) HTML-escapes the value; pass false for raw HTML tokens like {{LOGO}}.
function replaceToken(html: string, token: string, value: string, escape = true): string {
  if (!html.includes(token)) throw new Error(`Template token not found: ${token}`)
  return html.replace(token, escape ? escapeHtml(value) : value)
}

// {{ACCENT}} appears many times (style block + inline styles); replace all.
function replaceAccent(html: string, accent: string): string {
  return html.split('{{ACCENT}}').join(accent)
}

function stripRegion(html: string, startMarker: string, endMarker: string): string {
  const startIdx = html.indexOf(startMarker)
  if (startIdx === -1) throw new Error(`Template marker not found: ${startMarker}`)
  const endIdx = html.indexOf(endMarker, startIdx)
  if (endIdx === -1) throw new Error(`Template marker not found: ${endMarker}`)
  return html.slice(0, startIdx) + html.slice(endIdx + endMarker.length)
}

function postProcess(html: string, accent: string): string {
  return html
    .replace(/<a /g, `<a style="color:${accent}; text-decoration:none;" `)
    .replace(/<ol>/g, '<ol style="margin-top:0; padding-left:20px;">')
    .replace(/<ul>/g, '<ul style="margin-top:0; padding-left:20px;">')
    .replace(/<h2>/g, `<h2 style="font-size:24px; color:${accent}; margin-bottom:5px;">`)
    .replace(/<h3>/g, `<h3 style="font-size:18px; color:${accent}; margin-bottom:5px;">`)
}

function renderMarkdown(markdown: string, accent: string): string {
  return postProcess(marked.parse(markdown, { async: false }) as string, accent)
}

function buildLogo(dataUrl: string, text: string): string {
  if (dataUrl) {
    // Thunderbird strips max-width off a bare <img>, so wrap it in a table whose
    // width is set with the HTML width attribute (which Thunderbird respects)
    // and let the image fill the cell.
    return (
      '<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="300" style="width:300px; max-width:300px; margin:0 auto;">' +
      '<tr><td align="center" style="padding:0;">' +
      `<img src="${dataUrl}" alt="Logo" width="300" style="display:block; width:100%; max-width:300px; height:auto;">` +
      '</td></tr></table>'
    )
  }
  if (text.trim()) {
    return `<div style="font-size:28px; font-weight:bold; color:#ffffff; letter-spacing:0.5px;">${escapeHtml(text)}</div>`
  }
  return ''
}

function buildToc(items: string[]): string {
  const lis = items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')
  return `<ol style="margin-top:0; padding-left:20px;">${lis}</ol>`
}

function buildPlainTextWithLineBreaks(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br>')
}

function assembleHtml(state: PersistedState): string {
  let html = templateHtml
  const accent = state.accentColor

  if (!state.secondaryEnabled) {
    html = stripRegion(html, '<!-- EDIT SecondaryNotice -->', '<!-- SecondaryNotice End -->')
    html = stripRegion(html, '<!-- SECONDARY BLOCK START -->', '<!-- SECONDARY BLOCK END -->')
  } else {
    html = replaceSection(html, '<!-- EDIT SecondaryNotice -->', '<!-- SecondaryNotice End -->', escapeHtml(state.secondaryNotice))
  }

  // Primary language
  html = replaceSection(html, '<!-- EDIT Title -->', '<!-- Title End -->', escapeHtml(state.lang1Title))
  html = replaceSection(html, '<!-- EDIT Greeting -->', '<!-- Greeting End -->', escapeHtml(state.lang1Greeting))
  html = replaceSection(html, '<!-- EDIT Introduction -->', '<!-- Introduction End -->', renderMarkdown(state.lang1Intro, accent))
  html = replaceSection(html, '<!-- EDIT TocTitle -->', '<!-- TocTitle End -->', escapeHtml(state.lang1TocTitle))
  html = replaceSection(html, '<!-- EDIT TocList -->', '<!-- TocList End -->', buildToc(state.lang1Toc))
  html = replaceSection(html, '<!-- EDIT Main -->', '<!-- Main End -->', renderMarkdown(state.lang1Main, accent))
  html = replaceSection(html, '<!-- EDIT FinalGreeting1 -->', '<!-- FinalGreeting1 End -->', escapeHtml(state.lang1FinalGreeting1))
  html = replaceSection(html, '<!-- EDIT FinalGreeting2 -->', '<!-- FinalGreeting2 End -->', escapeHtml(state.lang1FinalGreeting2))

  // Secondary language
  if (state.secondaryEnabled) {
    html = replaceSection(html, '<!-- EDIT Title2 -->', '<!-- Title2 End -->', escapeHtml(state.lang2Title))
    html = replaceSection(html, '<!-- EDIT Greeting2 -->', '<!-- Greeting2 End -->', escapeHtml(state.lang2Greeting))
    html = replaceSection(html, '<!-- EDIT Introduction2 -->', '<!-- Introduction2 End -->', renderMarkdown(state.lang2Intro, accent))
    html = replaceSection(html, '<!-- EDIT TocTitle2 -->', '<!-- TocTitle2 End -->', escapeHtml(state.lang2TocTitle))
    html = replaceSection(html, '<!-- EDIT TocList2 -->', '<!-- TocList2 End -->', buildToc(state.lang2Toc))
    html = replaceSection(html, '<!-- EDIT Main2 -->', '<!-- Main2 End -->', renderMarkdown(state.lang2Main, accent))
    html = replaceSection(html, '<!-- EDIT FinalGreeting2-1 -->', '<!-- FinalGreeting2-1 End -->', escapeHtml(state.lang2FinalGreeting1))
    html = replaceSection(html, '<!-- EDIT FinalGreeting2-2 -->', '<!-- FinalGreeting2-2 End -->', escapeHtml(state.lang2FinalGreeting2))
  }

  // Footer
  html = replaceSection(html, '<!-- EDIT FooterAddress -->', '<!-- FooterAddress End -->', buildPlainTextWithLineBreaks(state.footerAddress))
  html = replaceSection(html, '<!-- EDIT FooterEmailText -->', '<!-- FooterEmailText End -->', escapeHtml(state.footerEmailText))
  html = replaceSection(html, '<!-- EDIT FooterMailinglistText -->', '<!-- FooterMailinglistText End -->', escapeHtml(state.footerMailinglistText))
  html = replaceSection(html, '<!-- EDIT FooterUnsubscribeText -->', '<!-- FooterUnsubscribeText End -->', escapeHtml(state.footerUnsubscribeText))
  html = replaceSection(html, '<!-- EDIT FooterUnsubscribeLinkText -->', '<!-- FooterUnsubscribeLinkText End -->', escapeHtml(state.footerUnsubscribeLinkText))

  // Tokens
  // Use the (possibly recolored) render URL; fall back to the original while an
  // async recolor is still in flight so the logo never momentarily vanishes.
  html = replaceToken(html, '{{LOGO}}', buildLogo(logoRenderUrl || state.logoDataUrl, state.logoText), false)
  html = replaceToken(html, '{{FOOTER_EMAIL_HREF}}', state.footerEmailHref)
  html = replaceToken(html, '{{FOOTER_MAILINGLIST_HREF}}', state.footerMailinglistHref)
  html = replaceToken(html, '{{FOOTER_UNSUBSCRIBE_HREF}}', state.footerUnsubscribeLinkHref)
  html = replaceAccent(html, accent)

  return html
}

function debounce<Args extends unknown[]>(fn: (...args: Args) => void, ms: number) {
  let timer: number | undefined
  return (...args: Args) => {
    if (timer !== undefined) window.clearTimeout(timer)
    timer = window.setTimeout(() => fn(...args), ms)
  }
}

function $<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Missing element #${id}`)
  return el as T
}

// --- DOM references ---
const lang1NameInput = $<HTMLInputElement>('lang1-name')
const lang2NameInput = $<HTMLInputElement>('lang2-name')
const accentColorInput = $<HTMLInputElement>('accent-color')
const accentHexInput = $<HTMLInputElement>('accent-hex')
const contrastBadge = $<HTMLSpanElement>('contrast-badge')
const paletteEl = $<HTMLDivElement>('palette')
const logoFileInput = $<HTMLInputElement>('logo-file')
const logoSampleBtn = $<HTMLButtonElement>('logo-sample')
const logoRemoveBtn = $<HTMLButtonElement>('logo-remove')
const logoTextInput = $<HTMLInputElement>('logo-text')
const logoToolsEl = $<HTMLDivElement>('logo-tools')
const logoSizeEl = $<HTMLSpanElement>('logo-size')
const logoDownloadBtn = $<HTMLButtonElement>('logo-download')
const recolorColorInput = $<HTMLInputElement>('recolor-color')
const recolorNoneBtn = $<HTMLButtonElement>('recolor-none')
const recolorWhiteBtn = $<HTMLButtonElement>('recolor-white')
const recolorBlackBtn = $<HTMLButtonElement>('recolor-black')
const recolorCustomBtn = $<HTMLButtonElement>('recolor-custom')

const lang1TitleInput = $<HTMLInputElement>('lang1-title')
const lang2TitleInput = $<HTMLInputElement>('lang2-title')
const secondaryNoticeInput = $<HTMLInputElement>('secondary-notice')

const lang1GreetingInput = $<HTMLInputElement>('lang1-greeting')
const lang2GreetingInput = $<HTMLInputElement>('lang2-greeting')

const lang1TocTitleInput = $<HTMLInputElement>('lang1-toc-title')
const lang2TocTitleInput = $<HTMLInputElement>('lang2-toc-title')
const lang1TocList = $<HTMLDivElement>('lang1-toc-list')
const lang2TocList = $<HTMLDivElement>('lang2-toc-list')
const lang1TocAddBtn = $<HTMLButtonElement>('lang1-toc-add')
const lang2TocAddBtn = $<HTMLButtonElement>('lang2-toc-add')

const lang1FinalGreeting1Input = $<HTMLInputElement>('lang1-final-greeting-1')
const lang1FinalGreeting2Input = $<HTMLInputElement>('lang1-final-greeting-2')
const lang2FinalGreeting1Input = $<HTMLInputElement>('lang2-final-greeting-1')
const lang2FinalGreeting2Input = $<HTMLInputElement>('lang2-final-greeting-2')

const footerAddressInput = $<HTMLTextAreaElement>('footer-address')
const footerEmailTextInput = $<HTMLInputElement>('footer-email-text')
const footerEmailHrefInput = $<HTMLInputElement>('footer-email-href')
const footerMailinglistTextInput = $<HTMLInputElement>('footer-mailinglist-text')
const footerMailinglistHrefInput = $<HTMLInputElement>('footer-mailinglist-href')
const footerUnsubscribeTextInput = $<HTMLInputElement>('footer-unsubscribe-text')
const footerUnsubscribeLinkTextInput = $<HTMLInputElement>('footer-unsubscribe-link-text')
const footerUnsubscribeLinkHrefInput = $<HTMLInputElement>('footer-unsubscribe-link-href')

const toggleSecondaryBtn = $<HTMLButtonElement>('toggle-secondary')
const previewIframe = $<HTMLIFrameElement>('preview')

let lang1IntroMde: EasyMDE
let lang2IntroMde: EasyMDE
let lang1MainMde: EasyMDE
let lang2MainMde: EasyMDE

let secondaryEnabled = true
let accentColor = DEFAULT_ACCENT
// `logoDataUrl` is the original imported image; `logoRecolor` is '' (use the
// original) or a hex color the image is re-tinted to; `logoRenderUrl` is the
// image actually embedded in the email (original or recolored), recomputed
// asynchronously whenever either changes.
let logoDataUrl = ''
let logoRecolor = ''
let logoRenderUrl = ''

// --- ToC rows ---
function createTocRow(list: HTMLDivElement, value: string): HTMLDivElement {
  const row = document.createElement('div')
  row.className = 'toc-row'

  const input = document.createElement('input')
  input.type = 'text'
  input.value = value
  input.addEventListener('input', scheduleUpdate)

  const removeBtn = document.createElement('button')
  removeBtn.type = 'button'
  removeBtn.textContent = '−'
  removeBtn.addEventListener('click', () => {
    row.remove()
    scheduleUpdate()
  })

  row.appendChild(input)
  row.appendChild(removeBtn)
  list.appendChild(row)
  return row
}

function getTocValues(list: HTMLDivElement): string[] {
  return Array.from(list.querySelectorAll<HTMLInputElement>('input[type="text"]')).map(
    (input) => input.value
  )
}

function setTocValues(list: HTMLDivElement, values: string[]): void {
  list.innerHTML = ''
  for (const value of values) createTocRow(list, value)
}

function collectState(): PersistedState {
  return {
    lang1Name: lang1NameInput.value,
    lang2Name: lang2NameInput.value,
    accentColor,
    logoDataUrl,
    logoRecolor,
    logoText: logoTextInput.value,
    secondaryEnabled,
    secondaryNotice: secondaryNoticeInput.value,
    lang1Title: lang1TitleInput.value,
    lang2Title: lang2TitleInput.value,
    lang1Greeting: lang1GreetingInput.value,
    lang2Greeting: lang2GreetingInput.value,
    lang1Intro: lang1IntroMde.value(),
    lang2Intro: lang2IntroMde.value(),
    lang1TocTitle: lang1TocTitleInput.value,
    lang2TocTitle: lang2TocTitleInput.value,
    lang1Toc: getTocValues(lang1TocList),
    lang2Toc: getTocValues(lang2TocList),
    lang1Main: lang1MainMde.value(),
    lang2Main: lang2MainMde.value(),
    lang1FinalGreeting1: lang1FinalGreeting1Input.value,
    lang1FinalGreeting2: lang1FinalGreeting2Input.value,
    lang2FinalGreeting1: lang2FinalGreeting1Input.value,
    lang2FinalGreeting2: lang2FinalGreeting2Input.value,
    footerAddress: footerAddressInput.value,
    footerEmailText: footerEmailTextInput.value,
    footerEmailHref: footerEmailHrefInput.value,
    footerMailinglistText: footerMailinglistTextInput.value,
    footerMailinglistHref: footerMailinglistHrefInput.value,
    footerUnsubscribeText: footerUnsubscribeTextInput.value,
    footerUnsubscribeLinkText: footerUnsubscribeLinkTextInput.value,
    footerUnsubscribeLinkHref: footerUnsubscribeLinkHrefInput.value,
  }
}

// --- Live language tags ---
function updateLangTags(): void {
  const names: Record<string, string> = {
    '1': lang1NameInput.value || 'Primary',
    '2': lang2NameInput.value || 'Secondary',
  }
  document.querySelectorAll<HTMLElement>('.lang-label[data-lang]').forEach((label) => {
    const lang = label.dataset.lang as string
    const section = label.dataset.section as string
    label.textContent = `${names[lang]} — ${section}`
  })
  toggleSecondaryBtn.textContent = `${names['2']}: ${secondaryEnabled ? 'On' : 'Off'}`
}

// --- Accent color + contrast ---
const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/

function updateContrastBadge(): void {
  const ratio = contrastRatio(accentColor, '#ffffff')
  const rounded = ratio.toFixed(1)
  let label: string
  let cls: string
  if (ratio >= 4.5) {
    label = `${rounded}:1 · AA`
    cls = 'pass'
  } else if (ratio >= 3) {
    label = `${rounded}:1 · large text only`
    cls = 'warn'
  } else {
    label = `${rounded}:1 · low contrast`
    cls = 'fail'
  }
  contrastBadge.textContent = label
  contrastBadge.className = `contrast-badge ${cls}`
  contrastBadge.title = 'Contrast of the accent color against the white content background (WCAG AA needs 4.5:1 for normal text).'
}

function setAccent(hex: string, opts: { syncColor?: boolean; syncHex?: boolean } = {}): void {
  accentColor = hex
  if (opts.syncColor !== false) accentColorInput.value = hex
  if (opts.syncHex !== false) accentHexInput.value = hex
  updateContrastBadge()
  highlightActiveSwatch()
}

function highlightActiveSwatch(): void {
  paletteEl.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.color?.toLowerCase() === accentColor.toLowerCase())
  })
}

function buildPalette(): void {
  for (const color of ACCENT_PALETTE) {
    const swatch = document.createElement('button')
    swatch.type = 'button'
    swatch.className = 'swatch'
    swatch.dataset.color = color
    swatch.style.background = color
    swatch.title = color
    swatch.addEventListener('click', () => {
      setAccent(color)
      scheduleUpdate()
    })
    paletteEl.appendChild(swatch)
  }
}

// --- Logo import ---
function readLogoFile(file: File): void {
  if (!file.type.startsWith('image/')) {
    showDraftFeedback('That file is not an image.', true)
    return
  }
  if (file.size > LOGO_MAX_BYTES) {
    showDraftFeedback(`Logo is too large (${Math.round(file.size / 1024)} KB). Max 100 KB.`, true)
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    logoDataUrl = reader.result as string
    logoRecolor = '' // a fresh import starts from its original colors
    void refreshLogo()
    if (file.size > LOGO_ADVISE_BYTES) {
      showDraftFeedback(`Logo added (${Math.round(file.size / 1024)} KB). Tip: ~20 KB keeps emails small.`)
    } else {
      showDraftFeedback('Logo added.')
    }
  }
  reader.onerror = () => showDraftFeedback('Could not read that image.', true)
  reader.readAsDataURL(file)
}

// --- Logo recolor / size / download / sample ---

// Tint the image to a single color: draw it, then `source-in` paints `color`
// only where the image is opaque, preserving the alpha shape. Re-exported as
// PNG (email clients render PNG far more reliably than SVG).
function recolorImage(srcDataUrl: string, color: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const w = img.naturalWidth || 300
      const h = img.naturalHeight || 100
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas not available'))
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      ctx.globalCompositeOperation = 'source-in'
      ctx.fillStyle = color
      ctx.fillRect(0, 0, w, h)
      try {
        resolve(canvas.toDataURL('image/png'))
      } catch (err) {
        reject(err as Error)
      }
    }
    img.onerror = () => reject(new Error('Could not load image for recolor'))
    img.src = srcDataUrl
  })
}

// Exact decoded byte size of a base64 data URL.
function dataUrlBytes(url: string): number {
  const comma = url.indexOf(',')
  return comma === -1 ? 0 : atob(url.slice(comma + 1)).length
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
}

function dataUrlExtension(url: string): string {
  const mime = url.slice(5, url.indexOf(';') === -1 ? url.indexOf(',') : url.indexOf(';'))
  if (mime === 'image/png') return 'png'
  if (mime === 'image/jpeg') return 'jpg'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/svg+xml') return 'svg'
  return 'img'
}

// Reflect the current logo state into the recolor controls + size readout, and
// show/hide the whole tools block depending on whether an image is loaded.
function updateLogoTools(): void {
  const hasImage = Boolean(logoDataUrl)
  logoToolsEl.hidden = !hasImage
  if (!hasImage) return

  const url = logoRenderUrl || logoDataUrl
  const bytes = dataUrlBytes(url)
  logoSizeEl.textContent = `Embedded size: ~${formatBytes(bytes)}`
  logoSizeEl.classList.toggle('over-advice', bytes > LOGO_ADVISE_BYTES)

  const r = logoRecolor.toLowerCase()
  recolorNoneBtn.classList.toggle('active', r === '')
  recolorWhiteBtn.classList.toggle('active', r === '#ffffff')
  recolorBlackBtn.classList.toggle('active', r === '#000000')
  recolorCustomBtn.classList.toggle('active', r !== '' && r !== '#ffffff' && r !== '#000000')
}

// Recompute `logoRenderUrl` from the original + recolor choice, refresh the
// tools UI, and update the preview. Async because recolor goes through canvas.
async function refreshLogo(): Promise<void> {
  if (!logoDataUrl) {
    logoRenderUrl = ''
  } else if (!logoRecolor) {
    logoRenderUrl = logoDataUrl
  } else {
    try {
      logoRenderUrl = await recolorImage(logoDataUrl, logoRecolor)
    } catch {
      logoRenderUrl = logoDataUrl
      showDraftFeedback('Could not recolor that image.', true)
    }
  }
  updateLogoTools()
  updatePreview()
}

function setRecolor(color: string): void {
  logoRecolor = color
  void refreshLogo()
}

function downloadLogo(): void {
  const url = logoRenderUrl || logoDataUrl
  if (!url) return
  const a = document.createElement('a')
  a.href = url
  a.download = `logo.${dataUrlExtension(url)}`
  a.click()
}

function fetchAsDataUrl(url: string): Promise<string> {
  return fetch(url)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.blob()
    })
    .then(
      (blob) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(reader.error)
          reader.readAsDataURL(blob)
        })
    )
}

// Bundled white masthead in public/, served under the Vite base path.
const SAMPLE_LOGO_URL = `${import.meta.env.BASE_URL}riverside-community-center-white.svg`

async function loadSampleLogo(): Promise<void> {
  try {
    logoDataUrl = await fetchAsDataUrl(SAMPLE_LOGO_URL)
    logoRecolor = ''
    await refreshLogo()
    showDraftFeedback('Sample logo added.')
  } catch {
    showDraftFeedback('Could not load the sample logo.', true)
  }
}

// --- Preview ---
const MOBILE_QUERY = window.matchMedia('(max-width: 900px)')

// The single, currently-attached iframe `load` handler. `updatePreview` runs
// often (debounced per keystroke); replacing srcdoc fires a fresh `load`, so we
// keep exactly one handler alive at a time to avoid listener buildup.
let pendingPreviewLoad: (() => void) | null = null

function updatePreview(): void {
  const state = collectState()

  let scrollX = 0
  let scrollY = 0
  try {
    scrollX = previewIframe.contentWindow?.scrollX ?? 0
    scrollY = previewIframe.contentWindow?.scrollY ?? 0
  } catch {
    // contentWindow not readable yet (first call) — start from the top.
  }

  if (pendingPreviewLoad) {
    previewIframe.removeEventListener('load', pendingPreviewLoad)
    pendingPreviewLoad = null
  }

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
    previewIframe.contentWindow?.scrollTo(scrollX, scrollY)
  }
  pendingPreviewLoad = onLoad
  previewIframe.addEventListener('load', onLoad, { once: true })

  previewIframe.srcdoc = assembleHtml(state)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

const scheduleUpdate = debounce(updatePreview, 200)

function loadState(): PersistedState {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaultState()
  try {
    return { ...defaultState(), ...JSON.parse(raw) }
  } catch {
    return defaultState()
  }
}

function setSecondaryVisibility(enabled: boolean): void {
  document.querySelectorAll<HTMLElement>('.secondary-only').forEach((el) => {
    el.style.display = enabled ? '' : 'none'
  })
  updateLangTags()
}

function applyState(state: PersistedState): void {
  lang1NameInput.value = state.lang1Name
  lang2NameInput.value = state.lang2Name

  setAccent(state.accentColor)
  logoDataUrl = state.logoDataUrl
  logoRecolor = state.logoRecolor
  logoTextInput.value = state.logoText
  if (recolorColorInput && state.logoRecolor && HEX_PATTERN.test(state.logoRecolor)) {
    recolorColorInput.value = state.logoRecolor
  }
  void refreshLogo()

  secondaryNoticeInput.value = state.secondaryNotice
  lang1TitleInput.value = state.lang1Title
  lang2TitleInput.value = state.lang2Title

  lang1GreetingInput.value = state.lang1Greeting
  lang2GreetingInput.value = state.lang2Greeting

  lang1IntroMde.value(state.lang1Intro)
  lang2IntroMde.value(state.lang2Intro)
  lang1MainMde.value(state.lang1Main)
  lang2MainMde.value(state.lang2Main)

  lang1TocTitleInput.value = state.lang1TocTitle
  lang2TocTitleInput.value = state.lang2TocTitle
  setTocValues(lang1TocList, state.lang1Toc)
  setTocValues(lang2TocList, state.lang2Toc)

  lang1FinalGreeting1Input.value = state.lang1FinalGreeting1
  lang1FinalGreeting2Input.value = state.lang1FinalGreeting2
  lang2FinalGreeting1Input.value = state.lang2FinalGreeting1
  lang2FinalGreeting2Input.value = state.lang2FinalGreeting2

  footerAddressInput.value = state.footerAddress
  footerEmailTextInput.value = state.footerEmailText
  footerEmailHrefInput.value = state.footerEmailHref
  footerMailinglistTextInput.value = state.footerMailinglistText
  footerMailinglistHrefInput.value = state.footerMailinglistHref
  footerUnsubscribeTextInput.value = state.footerUnsubscribeText
  footerUnsubscribeLinkTextInput.value = state.footerUnsubscribeLinkText
  footerUnsubscribeLinkHrefInput.value = state.footerUnsubscribeLinkHref

  secondaryEnabled = state.secondaryEnabled
  setSecondaryVisibility(secondaryEnabled)
  updateLangTags()
}

function initEasyMde(elementId: string): EasyMDE {
  return new EasyMDE({
    element: document.getElementById(elementId) as HTMLTextAreaElement,
    spellChecker: false,
    status: false,
    toolbar: [...EDITOR_TOOLBAR_OPTIONS],
  })
}

const HEADING_DEBOUNCE_MS = 700
const H1_PATTERN = /^#(?!#)\s/m
const H4_PLUS_PATTERN = /^#{4,6}\s/m
const HEADING_HINT =
  'Only H2 (##) and H3 (###) headings work in an email body. Change the # heading (H1 — reserved for the newsletter title) or #### heading (H4–H6 — too small for email) to ## or ###.'

// Per-editor warning state: the yellow hint shown below each editor, and
// whether that editor currently has an invalid heading. Buttons that produce
// the final HTML turn yellow when any editor is invalid.
const editors: { mde: EasyMDE; hint: HTMLElement; invalid: boolean }[] = []
const warningButtons: HTMLButtonElement[] = []

function anyHeadingInvalid(): boolean {
  return editors.some(e => e.invalid)
}

function updateWarningButtons(): void {
  const warn = anyHeadingInvalid()
  for (const btn of warningButtons) btn.classList.toggle('has-warning', warn)
}

function checkHeadings(mde: EasyMDE): void {
  const content = mde.value()
  const invalid = H1_PATTERN.test(content) || H4_PLUS_PATTERN.test(content)
  mde.codemirror.getWrapperElement().classList.toggle('heading-warning', invalid)
  const entry = editors.find(e => e.mde === mde)
  if (entry) {
    entry.hint.hidden = !invalid
    if (invalid) entry.hint.textContent = HEADING_HINT
    entry.invalid = invalid
  }
  updateWarningButtons()
}

// Copy/export still works despite heading warnings — the warning is advisory,
// so confirm rather than block. Returns false only if the user backs out.
function confirmDespiteWarnings(): boolean {
  if (!anyHeadingInvalid()) return true
  return confirm(
    'Some editor boxes still have heading problems — only H2 (##) and H3 (###) are allowed in the body. Produce the HTML anyway?'
  )
}

function showCopyFeedback(button: HTMLButtonElement): void {
  const original = button.textContent
  button.textContent = 'Copied!'
  button.classList.add('copy-feedback')
  setTimeout(() => {
    button.textContent = original
    button.classList.remove('copy-feedback')
  }, 1500)
}

async function copyHtml(button: HTMLButtonElement): Promise<void> {
  if (!confirmDespiteWarnings()) return
  const html = assembleHtml(collectState())
  await navigator.clipboard.writeText(html)
  showCopyFeedback(button)
}

function downloadBlob(content: string, type: string, filename: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportHtml(): void {
  if (!confirmDespiteWarnings()) return
  downloadBlob(assembleHtml(collectState()), 'text/html', 'newsletter.html')
}

const draftFeedback = $<HTMLParagraphElement>('draft-feedback')
let draftFeedbackTimer: number | undefined

function showDraftFeedback(message: string, isError = false): void {
  draftFeedback.textContent = message
  draftFeedback.classList.toggle('error', isError)
  draftFeedback.hidden = false
  if (draftFeedbackTimer !== undefined) window.clearTimeout(draftFeedbackTimer)
  draftFeedbackTimer = window.setTimeout(() => {
    draftFeedback.hidden = true
  }, 3000)
}

function exportDraft(): void {
  downloadBlob(JSON.stringify(collectState(), null, 2), 'application/json', 'newsletter-draft.json')
}

async function importDraft(file: File): Promise<void> {
  try {
    const parsed = JSON.parse(await file.text())
    applyState({ ...defaultState(), ...parsed })
    updatePreview()
    showDraftFeedback('Draft imported.')
  } catch {
    showDraftFeedback('Could not import draft — not a valid draft file.', true)
  }
}

async function loadSample(): Promise<void> {
  applyState({ ...defaultState(), ...SAMPLE_STATE })
  // The sample is "Riverside Community Center" — pair it with the bundled white
  // masthead so the demo shows a finished newsletter, logo and all.
  await loadSampleLogo()
  showDraftFeedback('Sample newsletter loaded.')
}

function renderSiteFooterNote(): void {
  const note = $<HTMLParagraphElement>('site-footer-note')
  const license = `<a href="${__APP_LICENSE_URL__}" target="_blank" rel="noopener">MIT License</a>`
  const email = `<a href="mailto:${__APP_CONTACT_EMAIL__}">${__APP_CONTACT_EMAIL__}</a>`
  note.innerHTML =
    `Mail Builder — a free, open-source newsletter tool. Built in ${__APP_CREATED__} by ${__APP_AUTHOR__}. ` +
    `Released under the ${license}. Questions or feedback? Reach out at ${email}.`
}

function resetAll(): void {
  if (!confirm('Reset all fields and clear saved data?')) return
  localStorage.removeItem(STORAGE_KEY)
  applyState(defaultState())
  updatePreview()
}

function init(): void {
  lang1IntroMde = initEasyMde('lang1-intro')
  lang2IntroMde = initEasyMde('lang2-intro')
  lang1MainMde = initEasyMde('lang1-main')
  lang2MainMde = initEasyMde('lang2-main')

  for (const mde of [lang1IntroMde, lang2IntroMde, lang1MainMde, lang2MainMde]) {
    // A yellow hint sits directly below each editor, explaining the rule when
    // that editor breaks it.
    const container = mde.codemirror.getWrapperElement().closest('.EasyMDEContainer')
    const hint = document.createElement('p')
    hint.className = 'heading-hint'
    hint.hidden = true
    container?.after(hint)
    editors.push({ mde, hint, invalid: false })

    const scheduleHeadingCheck = debounce(() => checkHeadings(mde), HEADING_DEBOUNCE_MS)
    mde.codemirror.on('change', () => {
      scheduleUpdate()
      scheduleHeadingCheck()
    })
  }

  const plainTextInputs = [
    logoTextInput,
    lang1TitleInput, lang2TitleInput, secondaryNoticeInput,
    lang1GreetingInput, lang2GreetingInput,
    lang1TocTitleInput, lang2TocTitleInput,
    lang1FinalGreeting1Input, lang1FinalGreeting2Input,
    lang2FinalGreeting1Input, lang2FinalGreeting2Input,
    footerAddressInput, footerEmailTextInput, footerEmailHrefInput,
    footerMailinglistTextInput, footerMailinglistHrefInput,
    footerUnsubscribeTextInput, footerUnsubscribeLinkTextInput, footerUnsubscribeLinkHrefInput,
  ]
  for (const input of plainTextInputs) input.addEventListener('input', scheduleUpdate)

  // Language names drive the live tags too, not just the preview.
  for (const input of [lang1NameInput, lang2NameInput]) {
    input.addEventListener('input', () => {
      updateLangTags()
      scheduleUpdate()
    })
  }

  // Accent color picker + hex input (kept in sync) + palette.
  buildPalette()
  accentColorInput.addEventListener('input', () => {
    setAccent(accentColorInput.value, { syncColor: false })
    scheduleUpdate()
  })
  accentHexInput.addEventListener('input', () => {
    const v = accentHexInput.value.trim()
    if (HEX_PATTERN.test(v)) {
      setAccent(v, { syncHex: false })
      scheduleUpdate()
    }
  })

  // Logo import + sample + remove.
  logoFileInput.addEventListener('change', () => {
    const file = logoFileInput.files?.[0]
    if (file) readLogoFile(file)
    logoFileInput.value = ''
  })
  logoSampleBtn.addEventListener('click', () => void loadSampleLogo())
  logoRemoveBtn.addEventListener('click', () => {
    logoDataUrl = ''
    logoRecolor = ''
    void refreshLogo()
    showDraftFeedback('Logo image removed.')
  })

  // Logo recolor controls + size readout + download.
  recolorNoneBtn.addEventListener('click', () => setRecolor(''))
  recolorWhiteBtn.addEventListener('click', () => setRecolor('#ffffff'))
  recolorBlackBtn.addEventListener('click', () => setRecolor('#000000'))
  recolorCustomBtn.addEventListener('click', () => setRecolor(recolorColorInput.value))
  recolorColorInput.addEventListener('input', () => setRecolor(recolorColorInput.value))
  logoDownloadBtn.addEventListener('click', downloadLogo)

  lang1TocAddBtn.addEventListener('click', () => {
    createTocRow(lang1TocList, 'New item')
    scheduleUpdate()
  })
  lang2TocAddBtn.addEventListener('click', () => {
    createTocRow(lang2TocList, 'New item')
    scheduleUpdate()
  })

  toggleSecondaryBtn.addEventListener('click', () => {
    secondaryEnabled = !secondaryEnabled
    setSecondaryVisibility(secondaryEnabled)
    scheduleUpdate()
  })

  const copyTop = $<HTMLButtonElement>('copy-html-top')
  const copyBottom = $<HTMLButtonElement>('copy-html-bottom')
  const exportTop = $<HTMLButtonElement>('export-html-top')
  const exportBottom = $<HTMLButtonElement>('export-html-bottom')
  copyTop.addEventListener('click', (e) => copyHtml(e.currentTarget as HTMLButtonElement))
  copyBottom.addEventListener('click', (e) => copyHtml(e.currentTarget as HTMLButtonElement))
  exportTop.addEventListener('click', exportHtml)
  exportBottom.addEventListener('click', exportHtml)
  // These four buttons turn yellow when any editor has a heading problem.
  warningButtons.push(copyTop, copyBottom, exportTop, exportBottom)
  $<HTMLButtonElement>('reset-all-top').addEventListener('click', resetAll)
  $<HTMLButtonElement>('reset-all').addEventListener('click', resetAll)
  $<HTMLButtonElement>('load-sample').addEventListener('click', loadSample)

  const importDraftFile = $<HTMLInputElement>('import-draft-file')
  $<HTMLButtonElement>('export-draft').addEventListener('click', exportDraft)
  $<HTMLButtonElement>('import-draft').addEventListener('click', () => importDraftFile.click())
  importDraftFile.addEventListener('change', () => {
    const file = importDraftFile.files?.[0]
    if (file) importDraft(file)
    importDraftFile.value = ''
  })

  MOBILE_QUERY.addEventListener('change', updatePreview)

  renderSiteFooterNote()

  applyState(loadState())
  updatePreview()

  // Reflect any heading problems present in restored/sample content right away
  // (the per-keystroke check only fires on later edits).
  for (const mde of [lang1IntroMde, lang2IntroMde, lang1MainMde, lang2MainMde]) {
    checkHeadings(mde)
  }
}

init()
