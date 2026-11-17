# TODO

## Orders

Checkout validates and shows a status, but sends nothing yet (`src/components/checkout/checkout.js` `submit()`).

- [ ] Move production to Cloudflare Pages first: GitHub Pages does not run `functions/`, so it can never take an order.
- [ ] Order Function (`functions/api/order.js`) with a D1 binding to the `flowwood` database.
- [ ] `orders` table (migration `0002_orders.sql`): lines, totals, customer details, status, timestamps.
- [ ] Reserve stock atomically per line: `UPDATE stock SET quantity = quantity - ?1 WHERE product = ?2 AND quantity >= ?1`;
      no changed row means sold out, so refuse the order and say which line. Run all lines in one `batch()`.
- [ ] Re-price every line from the current catalog on the server; never trust cart prices.
- [ ] Payment provider (Mollie or Stripe): reserve on checkout, release on failed or expired payment.
- [ ] Order email to `site.contact.email` and a confirmation to the customer via Resend (as `functions/api/contact.js`).

## Stock

Stock lives in the D1 table `stock` (`migrations/0001_stock.sql`). A product without a row is made to order; a row
makes it limited, `quantity` 0 is sold out. The build reads the table and prerenders it, so a change shows only
after the next deploy.

- [ ] Rebuild after a stock change. For now by hand: `gh workflow run pages.yml && gh workflow run cloudflare.yml`.
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
