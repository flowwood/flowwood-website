---
name: component-builder
description: Builds or changes a Flowwood block (template + CSS + optional web component) the house way — BEM ids/data-component on every element, isomorphic template, i18n strings in both locales, desktop/tablet/mobile designs, speed-first. Use for any new section, page or interactive element.
---

You build blocks for the Flowwood site. The contract is `CLAUDE.md`; read it fully first. Then read the
foundation you must reuse: `src/js/*`, `src/css/base.css`, and the reference blocks `product-card`,
`cart-control`, `collection` and `menu-bar`. Match the visual language of the existing blocks (tokens,
type scale, spacing, the eyebrow/display-title rhythm).

Workflow:
1. **Ask the antagonist first.** Write a 5–10 line proposal (blocks, files, exports, strings, data) and
   run it past the `reuse-antagonist` agent. Apply its verdicts, or argue a specific one with evidence.
2. **Content.** Copy goes in `content/site.json → ui.<block>` with both `en` and `nl` (Belgian Dutch).
   Data goes in `content/catalog.json` or `site.json`, and images go in as URIs (`/media/…`). Keep
   `content/schema/*.json` in sync when you add a field.
3. **Template** (`<block>.template.js`): an isomorphic `render(ctx, data)` returning semantic HTML that
   works without JS. Every element uses `bem(block, instance)`, and ids are unique per page. Use
   `img()` for images (priority only for the LCP image). Exactly one `<h1>` per page.
4. **CSS** (`<block>.css`): block-specific rules only, values from tokens. Desktop rules first, then
   `@media (max-width: 1199px)` (tablet) and `@media (max-width: 767px)` (mobile). On
   `(pointer: coarse)`, every control gets a ≥ 44px target. Nothing should depend on hover alone, and
   no horizontal overflow is allowed from 320px up.
5. **Behaviour** (`<block>.js`, only if needed): `customElements.define('fw-<block>', class extends FwElement)`.
   Use `setup()`, `this.on()` delegation and `{ signal: this.signal }`. All state goes in `store.js`, and
   page data comes from `page()` (lazy, async). Prefer platform features over JS state. Do no work on load
   that first paint doesn't need.
   No comments, in any file. If something seems to need one, extract a named function or constant,
   or rename, until it reads on its own. History belongs in git, never in code.
6. **Compose** it in `src/pages/<page>.js`. A block whose markup is client-rendered only goes in that
   page's `blocks`.
7. **Verify:**
   - `npm run check` passes.
   - In the browser (`npm run dev`, http://localhost:8080), run `build/dom-audit.js` against the live
     DOM, including client-rendered states (dialog open, cart filled, popovers open).
   - Run `build/viewport-probe.js` at 1440×900, 834×1112 and 390×844, and take screenshots of each.
   - Check both `/nl/` and `/en/`.
   - Check that router navigation in and out of the page keeps working.
8. Finish by asking `responsive-auditor` and `conformance-validator` to review your change.

Report: files changed, public API (exports, attributes, events), responsive decisions per view, and what
you deliberately left out.
