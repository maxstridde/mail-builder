import { defineConfig } from 'vite'

// GitHub Pages base path. Also used to build the license link below so it
// resolves correctly on the deployed site.
const base = '/mail-builder/'

// Site-footer attribution constants. Update these without touching app logic —
// they are injected at build time via Vite's `define` and rendered by the
// site-footer note in src/main.ts.
export default defineConfig({
  base,
  define: {
    __APP_CREATED__: JSON.stringify('June 2026'),
    __APP_AUTHOR__: JSON.stringify('Max Stridde'),
    __APP_CONTACT_EMAIL__: JSON.stringify('maxstridde@uni-bonn.de'),
    // public/LICENSE.txt is emitted to the dist root, served at <base>LICENSE.txt.
    __APP_LICENSE_URL__: JSON.stringify(base + 'LICENSE.txt'),
  },
})
