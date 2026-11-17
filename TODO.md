# TODO

## Orders

`functions/api/order/[[path]].js` takes orders (see CLAUDE.md → Orders). Tested against a local D1 and a mocked Mollie;
not yet against Mollie itself.

- [ ] Move production to Cloudflare Pages on `flowwood.be` first: GitHub Pages does not run `functions/`, so it can
      never take an order (checkout there shows the "couldn't place your order" message with phone and email).
- [ ] Mollie account (live + test API keys, Bancontact, cards, iDEAL enabled; payouts and company verification done).
      Pages secret `MOLLIE_API_KEY`: the `test_…` key on preview, the `live_…` key on production.
- [ ] Bind D1 `flowwood` as `DB` on the Pages project and apply `0002_orders.sql` and `0003_rate_limit.sql` remotely.
- [ ] Verify `flowwood.be` in Resend (SPF/DKIM) so `website@flowwood.be` can send; `RESEND_API_KEY` on the project.
- [ ] Test end to end on a preview deploy with the Mollie test key: paid, failed, canceled, expired, sold out mid-checkout,
      both emails.
- [ ] The customer email links the terms; decide whether the confirmation must carry the terms and withdrawal form
      as an attachment (durable medium).
- [ ] An order whose Function dies between reserving stock and creating the payment stays `pending` with stock held.
      Rare; release such orders (pending, no `payment`, older than an hour) by hand or from a scheduled Worker.
- [ ] Orders view in the admin (today: the shop email and the Mollie dashboard). Refunds happen in the Mollie dashboard
      and do not return stock.
- [ ] Turnstile on checkout if bots start reserving stock; today the order POST has the Origin check and 10 per IP per
      10 minutes.

## Stock

Stock lives in the D1 table `stock` (`migrations/0001_stock.sql`). A product without a row is made to order; a row
makes it limited, `quantity` 0 is sold out. The build reads the table and prerenders it, so a change shows only
after the next deploy.

- [ ] Rebuild after a stock change. For now by hand: `gh workflow run pages.yml && gh workflow run cloudflare.yml`.
      Until then a product page can show stock that is gone; the order Function refuses the order and says what is left.
      Later the order Function and the admin trigger it (`workflow_dispatch` via the GitHub App) when a product sells
      out or its count is edited.
- [ ] Edit stock in the CMS admin: toggle "limited stock" (insert/delete the row) and set the quantity
      (needs a D1 binding on `functions/api/cms` and a local D1 copy for `npm run dev`, so testing never touches real stock).
- [ ] Carts above stock: a visitor who already holds more than is left keeps the excess (only "+" is disabled).
      Clamp or flag those lines in the cart and at checkout.
- [ ] Carts holding a product or finish that no longer exists: `catalog.product(id)` returns undefined and
      `price()`/`lineKey()` fail on it. Drop such lines and say so.
- [ ] Stock is per product, across every finish and size, custom sizes included. Decide whether sized products
      need stock per finish or per size, and whether a custom size (made to order) should count against stock.
- [ ] Give the build its own read-only D1 token instead of the deploy token.

## CMS admin

- [ ] Enable Cloudflare Zero Trust (dashboard), then an Access application for `/admin*` and `/api/cms*`
      (and `*.flowwood-website.pages.dev`) with an allow-list of editor emails.
- [ ] Cloudflare Pages secrets: GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY (PKCS#8), GITHUB_REPO, CF_ACCESS_TEAM_DOMAIN, CF_ACCESS_AUD.
- [ ] On a failed build after a CMS commit, open an issue for the owner (`if: failure()` step).

## Abuse protection

`functions/_lib/guard.js` checks the Origin, a Turnstile token and a per-IP limit in D1 (`migrations/0003_rate_limit.sql`).

- [ ] Turnstile widget (dashboard → Turnstile → Add widget, managed, hostnames flowwood.be and flowwood-website.pages.dev):
      put its site key in `site.json → turnstileSiteKey` (now the always-pass test key) and its secret in the Pages
      secret `TURNSTILE_SECRET_KEY` (production and preview). Without the secret every form post is refused.
- [ ] Bind the `flowwood` D1 database as `DB` to the Pages project (Settings → Bindings) and apply the migrations
      remotely; without the binding the per-IP limit is skipped.
- [ ] Once production runs on Cloudflare Pages with the custom domain: WAF rate limiting rule on the `flowwood.be` zone
      (Security → WAF → Rate limiting rules): `(http.request.uri.path wildcard "/api/*" and http.request.method eq "POST"
      and http.request.uri.path ne "/api/order/webhook")`, by IP, 5 requests per 10 seconds, block for 10 seconds
      (the Free plan limits; on Pro: 10 per minute, block 10 minutes). It does not apply to `*.pages.dev`.
