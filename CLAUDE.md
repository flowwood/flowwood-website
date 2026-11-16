# Flowwood website

Production implementation of the Flowwood shop, served by GitHub Pages at
https://flowwood.github.io/flowwood-website/ (built and deployed by `.github/workflows/pages.yml` on every
push to `main`). The same push also deploys the dev environment on Cloudflare Pages at
https://flowwood-website.pages.dev (`.github/workflows/cloudflare.yml`, project `flowwood-website`), which runs
`functions/` and honours `_headers`. Secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` live in the repo;
locally the same values sit in the gitignored `.cloudflare.env`.

## Principles (in priority order)

1. **Speed is mandatory.** First paint needs no JS and no data fetch. Every change is judged by what it
   costs on the critical path.
2. **YAGNI.** Build only what a page uses today. Before adding a module, block, helper or token, look
   for an existing one and extend it. Keep together what belongs together. No one-function files.
3. **Lean.** Plain HTML, CSS, JavaScript and Web Components. No runtime dependencies, no framework,
   no bundler. `npm` has zero dependencies. Node is used only at build time.
4. **No comments.** Names and small functions carry the meaning. When code seems to need a comment,
   decompose it first: extract a named function or constant, rename, or split the step. Never record
   history in code (what it was, what changed, what was fixed or removed, what an earlier version did). Git
   holds the history, and this file holds the architecture. `npm run check` fails on comments in
   `src/` and `build/`. The build's HTML markers (`<!--fonts-->`, `<!--head-->`) are placeholders,
   not comments.

## How it works

```
content/*.json ──► build/build.mjs ──► dist/{locale}/{slug}/index.html   (prerendered, CSS inlined)
                   (GitHub Actions: `npm run check` with BASE_PATH, then deploy `dist/` to Pages)
browser:  HTML paints → app.js upgrades <fw-*> elements on demand → router takes over navigation
```

* **Prerender at build time.** Page templates turn the JSON into finished HTML for every
  locale × page. Web components only *enhance* that HTML with behaviour; they never render the first
  view, except for the cart grid, the checkout order summary and the custom-size dialog, whose content depends on client state.
* **Stock.** The D1 database `flowwood` (table `stock`, schema in `migrations/`) is the only source of stock. The build
  reads it through the D1 REST API (`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`, locally from `.cloudflare.env`; the
  build fails without them) and sets `stock` on every product: `null` (no row) is made to order, a number is limited,
  `0` is sold out. Templates prerender it and `<fw-cart-control data-stock>` caps the cart per product; pages never
  fetch it. A stock change goes live on the next deploy. Open work is in `TODO.md`.
* **Routing.** Every URL is a real file: `/{locale}/{slug}/`, with slugs localised in
  `content/site.json` (`/nl/winkel/`, `/en/shop/`). `src/js/router.js` makes it feel like a SPA: it
  intercepts same-origin links, prefetches on hover, focus or touch, swaps `<body>` in place
  (inside a View Transition when the browser supports one), updates `<head>`, and calls
  `pushState`. Any failure falls back to a normal navigation.
* **Base path.** The site can live in a subfolder (GitHub Pages serves it under `/flowwood-website/`).
  The build reads `BASE_PATH` and `SITE_ORIGIN` from the environment (the workflow takes both from the
  Pages settings; empty locally). Files in `dist/` stay at the root; every public URL gets the base:
  `i18n.url()`, hashed asset URLs, import-map keys, the root redirect and the service-worker list. Browser
  code never writes a root-absolute path: it resolves against its own module
  (`new URL('../data/catalog.js', import.meta.url)`) or imports relatively.
* **Languages.** Locale is the first path segment. Every page links its counterparts with
  `hreflang`. The language switch is plain links to the same route in the other locale. `/` redirects
  to the locale of the last page the visitor saw (localStorage `fw:locale`, set on every page, so both
  the language switch and a typed `/en/…` count), and to the default `nl` on a first visit.
* **Speed, McMaster style.** Inline per-page critical CSS, self-hosted variable fonts (preloaded),
  LCP image preload with `fetchpriority=high`, explicit `width`/`height` on every image, `loading=lazy`
  below the fold, native ES modules with content-hashed names and an inline import map (only modules the
  browser runs), data modules (`/data/catalog.js`, `/data/site.<locale>.js`) prefetched at idle, a service
  worker that precaches every page (versioned cache, stale-while-revalidate) and the hashed JS, data and fonts
  (one unversioned cache-first cache, so a deploy fetches only what changed and prunes the rest; media is cached
  on first use; `/admin/` and `/api/` bypass it), hover prefetch, and immutable cache headers (`_headers`, honoured by
  Cloudflare Pages; GitHub Pages ignores it).

## Layout

```
model.json         THE product model (JSON Schema): every field a product may have, as the content manager fills it in
content/
  site.json        locales, routes (localised slugs), UI strings, page copy
  catalog.json     product order (ids), custom-size pricing, collections
  products/        one file per product, <id>.json, each one follows model.json (the build validates it)
  media/           images; products reference them by file name, site.json by URI (/media/…)
  schema/          JSON Schemas for site.json and catalog.json: editor hints ($schema in each JSON) and enforced by the
                   build (src/js/schema.js); products are checked against model.json by build/products.mjs
src/
  css/base.css     THE base: tokens (+ per-view layout tokens), reset, typography and the shared primitives:
                     .button (--primary --outline --paper --small --icon)  .link  .eyebrow  .figure (prices)
                     .product-name  .marker (accent underline for aria-pressed/aria-current)  .media (image frame)
                     .swatch  .stepper  .popover + .popover-trigger  .hit (44px touch area on coarse pointers)
                     .visually-hidden (+ --mobile)
  js/              shared modules. Isomorphic ones (build + browser) have no DOM/Node APIs.
    bem.js         isomorphic: attribute helper for class/id/data-component (see Naming)
    i18n.js        isomorphic: t(), money(), url() for a locale
    catalog.js     isomorphic: pricing, cart line keys, option labels
    schema.js      isomorphic: JSON Schema validator (the subset content/schema uses), run by build and admin
    cms.js         isomorphic: CMS save rules shared by admin, dev server and functions/api/cms (paths, budgets, schema)
    store.js       browser: cart (localStorage, cross-tab), saved checkout details (opt-in) + in-memory product configuration
    router.js      browser: link interception, prefetch, body swap, history, view transitions
    app.js         browser entry: component autoloader, router start, SW registration
    element.js     browser: FwElement base class for all components
  components/<block>/
    <block>.template.js   render(data, ctx) → HTML string (isomorphic)
    <block>.css           block-specific CSS only (optional)
    <block>.js            custom element <fw-block> (optional, only if it has behaviour)
  components/field/   shared form field (label, hint, input/select/textarea, error), nested in contact and checkout;
                      FwElement.validates() wires its aria-invalid/aria-describedby
  pages/<page>.js  composes blocks for a page: { route, render(ctx), meta?, current?, lcp?, customSize?, blocks? }
  layout.js        the HTML document shell
  sw.js            service-worker source (build injects version, page list and hashed asset list)
  fonts/           self-hosted woff2 (variable)
build/
  build.mjs        prerender, hash, import map, inline CSS, SW, _headers, root redirect
  products.mjs     the product validator: every content/products/*.json against model.json (`make validate-products`)
  check.mjs        validates dist/: ids, data-component, BEM, hreflang, budgets
  serve.mjs        dev server with rebuild-on-change
  dom-audit.js     browser-side audit of the live DOM (paste into Playwright evaluate)
src/admin/         content editor (index.html, admin.js, admin.css), built only with ADMIN=1 (`npm run dev`,
                   cloudflare.yml), never for GitHub Pages; forms are generated from the content JSON + schemas
migrations/        D1 schema for the `flowwood` database (`cf d1 migrations apply <database-id>`)
functions/
  api/cms/[[path]].js  the admin's API (Cloudflare Pages only): verifies the Cloudflare Access JWT, reads and commits
                   content through a GitHub App (createCommitOnBranch on main, refused when the edited files moved),
                   proxies media and Actions status. Env: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PKCS#8),
                   GITHUB_REPO, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD. `npm run dev` serves the same API against the
                   working tree (build/serve.mjs), so the admin runs locally at /admin/ without GitHub or Access.
  api/contact.js   Cloudflare Pages Function (not run by GitHub Pages): the contact form posts here; it emails site.contact.email via
                   Resend and 303-redirects back to #contact__status--sent or --failed (shown with :target,
                   so the form works without JS; <fw-contact> posts with fetch instead and keeps the text on failure). Secret: RESEND_API_KEY (Cloudflare env, locally in .dev.vars).
```

## Naming: BEM everywhere

* **Blocks** = component folders = custom-element suffix: `components/product-card/` → `<fw-product-card>`.
  Kebab-case, lowercase.
* **Classes:** `block`, `block__element`, `block--modifier`, `block__element--modifier`. Styling only
  through classes, never ids or tags inside components.
* **Every element** in `<body>` has an `id` and a `data-component` attribute:
  * `data-component="<block>"`: the block that owns the element (nested blocks use their own name).
  * `id` = `block`, `block__element`, with `--instance` appended when the block repeats:
    `product-card--home-monolith`, `product-card__title--home-monolith`,
    `product-card__swatch--home-monolith-smoked-oak`. Ids must be unique per page.
  * Always generate these with `bem()` from `src/js/bem.js`, never by hand:
    ```js
    const b = bem('product-card', `home-${p.id}`);
    `<article ${b()}><h3 ${b('title')}>…</h3><button ${b('swatch', { key: f.id, mods: { active } })}>`
    ```
* JSON keys: camelCase. Ids in JSON (product, finish, collection, route): kebab-case.

## Responsive: desktop, tablet, mobile

Every block is designed and verified at three viewports. A change is not done until all three hold.

| view    | range         | verify at    | intent |
|---------|---------------|--------------|--------|
| desktop | ≥ 1200px      | 1440 × 900   | the reference design |
| tablet  | 768 – 1199px  | 834 × 1112   | same structure, narrower sidebar (`--sidebar-w`), 2-column grids |
| mobile  | ≤ 767px       | 390 × 844    | single column, no sidebar column, content stacked, thumb-reachable controls |

* Breakpoints are written as `@media (max-width: 1199px)` (tablet and down) and
  `@media (max-width: 767px)` (mobile), after the block's desktop rules. Custom properties can't be
  used in media queries, so these two numbers are the contract.
* Prefer fluid `clamp()` and intrinsic grids (`auto-fit`, `minmax`) over extra breakpoints. Use a
  container query only when a block's own width is what matters (cart grid, cart banner).
* Layout tokens (`--sidebar-w`, `--gutter`, `--gutter-bar`) are redefined per view in `base.css`.
  Blocks pick them up and never re-declare their own.
* Touch: on `(pointer: coarse)` every control has a ≥ 44 × 44px hit area: add the `.hit` primitive
  (or size it up in a coarse rule) rather than hand-rolling a pseudo-element. Nothing is reachable only by hover: hover effects are an extra,
  and the same information or action is always available without hover.
* No horizontal page scroll at any width ≥ 320px. Rails that scroll sideways (nav, shop filter) say so
  with `overflow-x: auto` and hidden scrollbars.
* The `responsive-auditor` agent checks all three views with screenshots and the overflow probe.

## Content (JSON)

* Translatable values are `{ "en": "…", "nl": "…" }`. The build fails if a locale is missing.
* **Products follow `model.json`.** It is the contract with the content manager and the source of truth
  for what a product page, card, cart line and shop entry show: every product-specific fact on those
  views comes from a model field (or is derived from one, like dimensions from `sizing`). Only shop-wide
  policy (delivery, returns, custom-size ranges) lives elsewhere. A new product-specific fact means a new
  optional field in `model.json` first, then the template reads it. Keep `model.json` descriptions
  written for the content manager.
* One product per file: `content/products/<id>.json` (file name = `id`), listed in shop order in
  `catalog.json → products`. The build checks every file against `model.json` and fails on an unlisted,
  missing or invalid product. The validator in `build/products.mjs` (`modelErrors`) covers only the keywords
  `model.json` uses; using a new keyword means extending it.
* Product images: `{ "file": "monolith-1.webp", "position": "50% 60%", "thumbnail": "monolith-1-thumb.webp" }`,
  file names in `content/media/`. The build resolves them to `{ src, width, height, position, thumbnail }`
  (size read from the file, WebP, JPEG or SVG `viewBox`; missing files or an edge above 1600px fail the build; only
  referenced media ships), so templates never see `file`. `img(image, { thumb: true })`
  shows the thumbnail where a photo is small (photo reel, shop filter, hero thumbs, cart) and falls back to
  the photo itself.
* Other images (`site.json`): `{ "src": "/media/<file>", "position": "50% 60%" }`; the build reads `width`/`height`
  from the file and content-hashes it. An absolute `https` URI is used as is and needs `width`/`height` in the JSON.
* `content/site.json` and `content/catalog.json` stay in canonical form (`JSON.stringify(…, null, 2)` + newline);
  `npm run check` fails otherwise, so a CMS save only diffs what changed.
* Prices are numbers in EUR. Formatting happens in `i18n.money()`.
* UI strings live in `site.json → ui`, grouped per block. Use `{name}` placeholders.

## Writing a component

1. Check `src/css/base.css`, `src/js/*` and the existing blocks for what you need. Reuse or extend first.
2. Template first: semantic HTML that works without JS. Use `bem()` for every element.
3. CSS only for what is specific to the block; tokens from `base.css` (`var(--…)`), no raw colours.
4. Behaviour (if any) in `<fw-block>` extending `FwElement`: event delegation on the host,
   `this.signal` for listeners (auto-cleaned on disconnect), no global state outside `store.js`.
5. Strings via `ctx.t()` (build) or `i18n` from the page data (browser). Never hard-code copy.
6. Design and check desktop, tablet and mobile (see Responsive).
7. `npm run check` must pass, and the live DOM must pass `build/dom-audit.js`.

## Commands

* `npm run build`: build to `dist/` (`BASE_PATH=/flowwood-website npm run build` to build for the Pages subfolder)
* `npm run dev`: build, serve on http://localhost:8080 and rebuild on change
* `npm run check`: build and validate the output
* `make validate-products`: check every product file against `model.json` (all problems at once, no build)
* `make check`: `make validate-products`, then `npm run check`

## Agents

`.claude/agents/` holds the quality team: `reuse-antagonist` (challenges duplication and YAGNI),
`component-builder` (builds blocks the house way), `product-steward` (adds products and migrates
`model.json` across every product file), `performance-auditor`, `responsive-auditor`
(desktop/tablet/mobile), `conformance-validator`.
Run the antagonist before adding anything new, and the validator before calling work done.
