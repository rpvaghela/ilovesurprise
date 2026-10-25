# Isolated Tests and Payout Release

## Safe local checks

The existing `.env` connects to the production database. Do not use it for test
purchases, account changes, refunds, schema pushes, or fixture cleanup.

Start Docker Desktop, then run from `backend/`:

```powershell
npm run prisma:generate
npm run build
npm run test:isolated
```

The runner creates a disposable PostgreSQL 16 container named `ils-test-*`, with a
random password, localhost-only random port, and an in-memory data directory. It
overrides both Prisma database URLs and provider credentials for its child
processes. Prisma may print `Environment variables loaded from .env`; its explicit
process variables still take precedence. Confirm the datasource is `ils_test` at
`127.0.0.1`. Tests reject other database targets before running. Each test file gets
clean tables, and the runner removes its container and temporary uploads afterward.

To run a focused file:

```powershell
npm run test:isolated -- tests/payouts.test.ts
```

If the process is forcibly terminated, inspect `docker ps -a` for the exact
`ils-test-*` container from that run before removing it. Never run broad Docker
prune or production database reset commands as test cleanup.

Stripe calls are mocked and unconfigured Stripe construction fails closed. Signed
webhook tests use the Stripe verifier with a fake local secret. Google credentials
are also test-only. These tests establish application behavior, not provider
connectivity, real transfers, or production readiness. Real Stripe test-mode
acceptance still requires authorized account access and a separate environment.

From `frontend/`, run `npm test` and `npm run build`. The payout component browser
check is `node scripts/audit-payout-browser.cjs` from `backend/`; it requires the
local Vite server and the temporary Playwright installation referenced in that
script. It intercepts API responses, so it is not a live end-to-end acceptance test.

## Payout scope

PDF pages 8, 10, 16-18 specify balances, requests, holds, review, approvals, payment
references, and preserved history. They do not specify an automatic transfer API.
The implementation therefore records administrator-reviewed manual payments. It
does not send money. Approval reserves funds; completion requires an actual payment
reference and updates the wallet and commission allocations transactionally.

`PAYOUTS_ENABLED` defaults to false. This prevents new queries from requiring
tables that an existing deployment does not yet have. The isolated test runner
enables it only after creating the test schema.

## Release order for an authorized operator

1. Finish outstanding paid enrollment/renewal, permission, and provider acceptance
   work in staging. Review the root `PROJECT_SCOPE_AUDIT.md` for other launch gaps.
2. Back up the production database, deployed backend, frontend assets, and private
   environment configuration. Verify restoration in an isolated environment.
3. Review and apply `prisma/patches/20261022_payout_history.sql` to staging first,
   then production through the authorized database connection. Do not use
   `prisma db push` against production. The additive patch preserves existing
   requests and ledger entries; it does not invent historical payment allocations.
4. Reconcile legacy balances and requests, especially existing paid requests,
   before allowing new payouts. Keep `PAYOUTS_ENABLED=false` during this work.
5. Deploy matching backend/schema/client and frontend builds. Enable
   `PAYOUTS_ENABLED=true` only after migration and reconciliation; restart the API.
6. Verify representative access, administrator review, staff denial, request
   reservations, and history using approved staging acceptance records first.
   Never simulate a real payout by marking a live request paid without payment.
7. For rollback, disable the flag and restore the prior application release. Keep
   additive history tables and financial records; do not delete them to roll back.
8. Rotate the exposed administrator password through a secure flow and remove
   obsolete deployed bundles after preserving the restricted rollback backup.

No production migration, deployment, credential rotation, or money transfer was
performed by the isolated test runner or this audit.
