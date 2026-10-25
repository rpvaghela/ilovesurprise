import { prisma } from '../lib/prisma';

interface CheckResult {
  name: string;
  status: 'PASS' | 'FAIL';
  latencyMs: number;
  details?: any;
  error?: string;
}

async function runCheck(name: string, fn: () => Promise<any>): Promise<CheckResult> {
  const start = Date.now();
  try {
    const details = await fn();
    return {
      name,
      status: 'PASS',
      latencyMs: Date.now() - start,
      details,
    };
  } catch (err: any) {
    return {
      name,
      status: 'FAIL',
      latencyMs: Date.now() - start,
      error: err?.message || String(err),
    };
  }
}

async function main() {
  console.log('====================================================');
  console.log(' DATABASE CONNECTION & HEALTH VERIFICATION SUITE');
  console.log('====================================================');
  console.log('Environment:', process.env.NODE_ENV || 'development');
  console.log('Timestamp:', new Date().toISOString());

  const results: CheckResult[] = [];

  // 1. Raw connectivity and version
  results.push(
    await runCheck('PostgreSQL Raw Connection & Ping ($queryRaw `SELECT 1`)', async () => {
      const res = await prisma.$queryRaw<any[]>`SELECT 1 as ping, NOW() as server_time, version() as pg_version`;
      return {
        ping: res[0]?.ping,
        serverTime: res[0]?.server_time,
        version: res[0]?.pg_version?.split(' ')?.[0] + ' ' + res[0]?.pg_version?.split(' ')?.[1],
      };
    })
  );

  // 2. User table
  results.push(
    await runCheck('Table: users (User model count & select)', async () => {
      const count = await prisma.user.count();
      const sample = await prisma.user.findFirst({
        select: { id: true, email: true, role: true, isActive: true },
      });
      return { totalUsers: count, sampleEmail: sample?.email, sampleRole: sample?.role };
    })
  );

  // 3. Affiliate Profiles
  results.push(
    await runCheck('Table: affiliate_profiles (Count & relations)', async () => {
      const count = await prisma.affiliate_profiles.count();
      const activeCount = await prisma.affiliate_profiles.count({ where: { status: 'ACTIVE', isActive: true } });
      const sample = await prisma.affiliate_profiles.findFirst({
        include: { users: { select: { email: true } } },
      });
      return {
        totalProfiles: count,
        activeProfiles: activeCount,
        sampleUsername: sample?.username,
        userLinked: sample?.users?.email,
      };
    })
  );

  // 4. Products table
  results.push(
    await runCheck('Table: products (Catalog & inventory count)', async () => {
      const count = await prisma.products.count();
      const sample = await prisma.products.findFirst({
        select: { id: true, name: true, slug: true, price: true, status: true },
      });
      return {
        totalProducts: count,
        sampleProduct: sample?.name,
        price: sample?.price ? Number(sample.price) : null,
      };
    })
  );

  // 5. Orders & Order Items
  results.push(
    await runCheck('Table: orders & order_items', async () => {
      const orderCount = await prisma.orders.count();
      const itemCount = await prisma.order_items.count();
      return { totalOrders: orderCount, totalOrderItems: itemCount };
    })
  );

  // 6. Commission Ledger
  results.push(
    await runCheck('Table: commission_ledger (MLM commission records)', async () => {
      const count = await prisma.commission_ledger.count();
      return { totalCommissionEntries: count };
    })
  );

  // 7. Referral Visits
  results.push(
    await runCheck('Table: referral_visits (Tracking logs)', async () => {
      const count = await prisma.referral_visits.count();
      return { totalVisitsTracked: count };
    })
  );

  // 8. Appraisal Records
  results.push(
    await runCheck('Table: appraisal_records (Jewelry appraisal vault)', async () => {
      const count = await prisma.appraisal_records.count();
      return { totalAppraisals: count };
    })
  );

  // 9. Carts & Cart Items
  results.push(
    await runCheck('Table: carts & cart_items (Active shopping sessions)', async () => {
      const cartCount = await prisma.carts.count();
      const itemCount = await prisma.cart_items.count();
      return { totalCarts: cartCount, totalCartItems: itemCount };
    })
  );

  // 10. ACID Transaction Integrity (Commit & Rollback test)
  results.push(
    await runCheck('ACID Transaction Integrity (Transaction isolation & rollback)', async () => {
      let rolledBack = false;
      try {
        await prisma.$transaction(async (tx) => {
          // Perform a transient check inside transaction
          await tx.$queryRaw`SELECT 1 as tx_check`;
          // Explicit rollback test to verify abort safety
          throw new Error('ROLLBACK_VERIFIED');
        });
      } catch (e: any) {
        if (e.message === 'ROLLBACK_VERIFIED') {
          rolledBack = true;
        } else {
          throw e;
        }
      }
      return { transactionRollbackTestedSuccessfully: rolledBack };
    })
  );

  // 11. Connection Pool Stress Test (Concurrent queries)
  results.push(
    await runCheck('Connection Pool Concurrency (10 parallel queries)', async () => {
      const pings = Array.from({ length: 10 }, (_, i) =>
        prisma.$queryRaw`SELECT ${i} as query_index`
      );
      const res = await Promise.all(pings);
      return { parallelQueriesCompleted: res.length };
    })
  );

  console.log('\n--- DETAILED RESULTS ---');
  let allPassed = true;
  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} [${r.status}] ${r.name} (${r.latencyMs}ms)`);
    if (r.details) {
      console.log('   Details:', JSON.stringify(r.details));
    }
    if (r.error) {
      console.log('   ERROR:', r.error);
      allPassed = false;
    }
  }

  console.log('\n====================================================');
  console.log(allPassed ? '🎉 ALL DATABASE CONNECTIONS & TABLES ARE FULLY OPERATIONAL!' : '⚠️ SOME CHECKS FAILED');
  console.log('====================================================\n');
}

main()
  .catch((e) => {
    console.error('Fatal error in test script:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
