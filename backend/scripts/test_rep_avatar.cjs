require('dotenv').config();
const { listUsers } = require('../dist/services/admin.service');

async function run() {
  const res = await listUsers({ role: 'AFFILIATE' });
  console.log('AFFILIATES from listUsers:', JSON.stringify(res, null, 2));
}

run().catch(console.error);
