# flowwood-website

Flowwood shop: prerendered, multilingual (`/nl/…`, `/en/…`), zero-dependency HTML/CSS/JS with web components.

```sh
npm run dev     # http://localhost:8080, rebuilds on change (service worker: use http://127.0.0.1:8080)
npm run check   # build + validate naming, metadata, speed budget
npm run build   # → dist/
```

**Deploy (GitHub Pages):** every push to `main` runs `.github/workflows/pages.yml`: it builds with
`npm run check` (base path `/flowwood-website`, taken from the Pages settings) and publishes `dist/` to
https://flowwood.github.io/flowwood-website/. `dist/` is never committed. With a custom domain set in the
Pages settings, the base path becomes empty automatically.

**Contact form:** `functions/api/contact.js` is a Cloudflare Pages Function. GitHub Pages only serves
static files, so on GitHub Pages the form cannot send and shows its fallback message pointing to
`info@flowwood.be`. To make it send, host the site (or just the function) on Cloudflare Pages:
1. In Resend, verify the domain `flowwood.be` (DNS records) so it may send as `website@flowwood.be`.
2. In Cloudflare Pages → Settings → Variables and Secrets, add the secret `RESEND_API_KEY`.

Local test of the function: `npm run build`, put `RESEND_API_KEY=…` in `.dev.vars` (git-ignored), then
`npx wrangler pages dev dist`.

- Content: `content/site.json` (locales, routes, copy) and `content/catalog.json` (products, collections).
- Architecture and conventions: [CLAUDE.md](CLAUDE.md).
