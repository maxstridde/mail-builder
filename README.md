# Mail Builder

A free, browser-based tool for writing a newsletter in Markdown and exporting it
as a ready-to-send, email-client-safe HTML email. Built for anyone sending
newsletters — teachers, small shops, clubs, community groups. No backend, no
accounts, no tracking: everything runs in your browser and is saved to
`localStorage`.

Live app: deployed automatically to GitHub Pages on every push to `main`.

![Editor demo](social-preview/assets/editor-demo.gif)

## Features

- **Write in Markdown**, get clean HTML — live preview as you type.
- **Two languages side by side**, with editable language names (the section tags
  update to whatever you call them) and an On/Off toggle for the second language.
- **Your accent color** — pick any color or use a preset; a live WCAG contrast
  badge warns when text would be hard to read on white.
- **Import a logo** — embedded straight into the email as base64 (no hosting
  needed). Aim for ~20 KB; max 100 KB.
- **Load a sample newsletter** to see a finished example, or start from neutral
  defaults.
- **Export / import drafts** as JSON to back up or hand off your work.
- **Copy HTML** or **download `newsletter.html`** when you're done.

## Usage

1. Set the look in **Appearance**: name your languages, choose an accent color,
   and optionally import a logo.
2. Fill in the content section by section — Greeting (incl. title), Introduction,
   Table of Contents, Main Text, Final Greeting, and Footer. Markdown is
   supported in the rich-text fields.
3. Watch the live preview on the right update as you type.
4. Click **Copy HTML** (or **Export .html**) and paste it into your mail program
   as the message body. See **How does this work?** in the app for step-by-step
   sending instructions (Thunderbird, Gmail, Outlook).

### Sending the email

The in-app **How does this work?** panel explains this in detail. In short, for
**Thunderbird**: compose a new message, choose **Insert ▸ HTML…**, paste the
copied HTML, and **delete the trailing empty line / leftover signature**
Thunderbird adds below the inserted email before sending. Most webmail clients
(Gmail, Outlook) don't accept a raw-HTML paste — paste the *rendered* email or
use the exported `.html` file instead.

### Notes

- Markdown editors only support **H2 (`##`)** and **H3 (`###`)** headings — H1 is
  reserved for the newsletter title. Typing an H1 or H4+ heading outlines that
  editor yellow as a warning.
- The `image` and `check-list` toolbar buttons are intentionally disabled;
  re-enable either by editing `EDITOR_TOOLBAR_OPTIONS` in `src/main.ts`.
- Your edits auto-save to the browser's `localStorage` and never leave your
  machine. Use **Export Draft** / **Import Draft** to move a draft between
  browsers or share it (the draft is the editable source; the HTML is the
  finished email).
- Use **Reset / Clear all** to wipe saved content and start over.

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # type-check + production build to dist/
npm run preview  # preview the production build
```

Any modern evergreen browser is sufficient — the app relies only on standard
`navigator.clipboard`, `Blob`, `FileReader`, and `localStorage` APIs.

## Deployment

Pushing to `main` triggers the GitHub Actions workflow
(`.github/workflows/deploy.yml`), which builds `dist/` and publishes it to
GitHub Pages.

First-time setup on the repo (one-time, manual):

1. **Settings → Pages → Build and deployment → Source** → **Deploy from a
   branch**, then pick branch **`gh-pages`** (created automatically by the
   workflow on first run), folder **/ (root)**.
2. **Settings → Actions → General → Workflow permissions** → enable **Read and
   write permissions** so the default `GITHUB_TOKEN` can publish. No extra
   secrets needed.

## Configuration

The attribution note at the bottom of the page (creation date, author, license
link, contact email) is **not** hardcoded in source. Edit the four `define`
constants in `vite.config.ts` — `__APP_CREATED__`, `__APP_AUTHOR__`,
`__APP_CONTACT_EMAIL__`, `__APP_LICENSE_URL__` — to update it; no app logic
changes required.

## Social preview

![OG preview](social-preview/og.png)

This image is also uploaded as the repo's social preview card (**Settings →
General → Social preview**), shown when the repo or live app link is shared on
GitHub, Slack, etc. Regenerate it with `social-preview/og.sh`; see
`social-preview/README.md` for the full image-tooling docs.

## Stack

Vite + TypeScript, [EasyMDE](https://github.com/Ionaru/easy-markdown-editor) for
the Markdown editors, [marked](https://github.com/markedjs/marked) for Markdown →
HTML rendering, and [wcag-contrast](https://www.npmjs.com/package/wcag-contrast)
for the accent-color contrast check. See `CLAUDE.md` for the full architecture
and template-injection details.

Licensed under the [MIT License](LICENSE).
