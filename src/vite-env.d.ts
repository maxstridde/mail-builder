/// <reference types="vite/client" />

declare module '*.html?raw' {
  const content: string
  export default content
}

// wcag-contrast ships no types; we only use hex(a, b) -> ratio.
declare module 'wcag-contrast' {
  export function hex(a: string, b: string): number
}

// Build-time attribution constants, injected via the `define` block in
// vite.config.ts. Edit the values there to update the site-footer note.
declare const __APP_CREATED__: string
declare const __APP_AUTHOR__: string
declare const __APP_CONTACT_EMAIL__: string
declare const __APP_LICENSE_URL__: string
