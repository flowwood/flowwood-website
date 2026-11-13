# flowwood-website

Flowwood shop: prerendered, multilingual (`/nl/…`, `/en/…`), zero-dependency HTML/CSS/JS with web components.

```sh
npm run dev     # http://localhost:8080, rebuilds on change (service worker: use http://127.0.0.1:8080)
npm run check   # build + validate naming, metadata, speed budget
npm run build   # → dist/
```

**Deploy (Cloudflare Pages):** build command `npm run build`, output directory `dist`, Node ≥ 20. Every push
rebuilds in CI. `dist/` is never committed.

**Contact form:** `functions/api/contact.js` sends messages to `info@flowwood.be` (`site.json → contact.email`)
through [Resend](https://resend.com). One-time setup:
1. In Resend, verify the domain `flowwood.be` (DNS records) so it may send as `website@flowwood.be`.
2. In Cloudflare Pages → Settings → Variables and Secrets, add the secret `RESEND_API_KEY`.

`npm run dev` doesn't run functions. To test the form locally: `npm run build`, put
`RESEND_API_KEY=…` in `.dev.vars` (git-ignored), then `npx wrangler pages dev dist`.

- Content: `content/site.json` (locales, routes, copy) and `content/catalog.json` (products, collections).
- Architecture and conventions: [CLAUDE.md](CLAUDE.md).
- Design reference (untouched prototype): `demo.html`.
