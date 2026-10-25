# Product Detail Performance Release

Date: 24 October 2026 (Asia/Calcutta)
Site: https://ilovesurprises.com

## Deployed scope

- `src/services/product.service.ts` and its compiled JavaScript.
- New `src/services/product-detail.query.ts` and its compiled JavaScript.
- Site-specific Nginx gzip settings for JavaScript, CSS, JSON, and SVG.
- No database schema/data changes, provider configuration changes, or payment,
  enrollment, staff-permission, or payout feature deployment.
- Existing production frontend bundles and public assets remain unchanged.

## Changes

Product details previously fetched relations sequentially across the remote
database connection. A parameterized PostgreSQL query now aggregates the same
product, category, images, variants, option values, and collection data in one
statement. Unused review-row retrieval was removed; review-summary fields are
preserved. Concurrent requests for the same identifier share one lookup.

Product creation, editing, and deletion now invalidate product caches. An older
in-flight detail lookup cannot repopulate the cache after invalidation. Detail
cache lifetime was reduced from one hour to one minute to limit staleness from
inventory mutations outside the product service. Checkout remains responsible
for authoritative inventory and price validation.

Nginx previously compressed HTML but not JavaScript. The deployed configuration
now compresses the existing assets without changing their content or URLs.

## Verification

- Backend TypeScript build passed.
- Full disposable-PostgreSQL suite: 223 tests passed across 25 files.
- Seven focused regressions cover response equivalence, missing relations,
  SQL parameterization, concurrent lookups, mutation invalidation, deletion, and
  invalidation during an in-flight query.
- Old and candidate service responses were identical for three real production
  products, including a candle, zodiac options, and a wax melt. Comparisons were
  read-only.
- On-VPS cold service comparison: old 4.4-5.5 seconds; candidate 1.6-2.1 seconds.
- After deployment, two cold API samples took 1.632 and 1.634 seconds; immediate
  cached repeats took 3 milliseconds. These are server-side measurements, not
  total browser navigation times.
- Live desktop/mobile product-card navigation reached the detail heading in
  approximately 0.5-0.9 seconds in the sampled runs. Images loaded, and no page
  errors or horizontal overflow were detected. These are not load-test SLAs.
- The large geography asset transferred 2,368,544 compressed bytes instead of
  8,716,448 bytes, approximately 73% less. Fresh first-page load still depends on
  network conditions and the existing frontend bundle.
- Post-release API/database health checks passed and PM2 reports the API online.

Browser verification: `node scripts/audit-product-performance.cjs`. This script
allows public GETs and the read-only product-batch POST, and blocks other writes.
Screenshots are in `../tmp/product-performance/live-product-1440.png` and
`../tmp/product-performance/live-product-390.png`.

## Frontend finding

An existing build grouping eagerly includes checkout-only geography data. A
candidate configuration separated it successfully, but the VPS source snapshot
does not exactly reproduce the current production bundles. One source hook was
also truncated; its candidate repair matched the complete local file's prefix.
The rebuilt frontend was deliberately NOT deployed, preventing unrelated
behavior changes. Reconcile the frontend release source before shipping the
lazy geography split. The workspace Vite configuration was left as it was.

## Rollback

Protected backup directory on the VPS:
`/var/backups/ilovesurprises/product-performance-20261024-001/before`

It contains the original product service source/JavaScript, original Nginx site
configuration, frontend build archive, and source snapshots. The deployment
script verifies live-file hashes before replacement and automatically restores
the service/configuration if its immediate health checks fail.

For a later authorized rollback, restore `before/product.service.ts` and
`before/product.service.js` to the corresponding backend service directories,
restore `before/nginx.conf` to `/etc/nginx/sites-available/ilovesurprises`, run
`nginx -t`, reload Nginx, and reload PM2 process `ilovesurprises-api`. The added
query helper is unused by the old service and may remain in place. There is no
database migration to reverse. No frontend restoration is needed for this release.
