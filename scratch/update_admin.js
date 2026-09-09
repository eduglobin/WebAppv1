const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgres://postgres.ifojeggpbgvvmdzcqpvo:Eduglobin2026@@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  await client.connect();
  console.log('Connected');
  
  // Update admin role in profiles
  const res = await client.query(`UPDATE profiles SET role = 'SUPER_ADMIN' WHERE role != 'SUPER_ADMIN' RETURNING id, role;`);
  console.log('Updated rows:', res.rows);
  
  await client.end();
}

main().catch(console.error);
