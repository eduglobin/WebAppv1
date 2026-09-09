import fs from 'fs';
import path from 'path';

// Parse .env
const envPath = path.resolve('..', '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const idx = trimmed.indexOf('=');
    if (idx > -1) {
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      env[key] = val;
    }
  }
});

const SUPABASE_URL = env.SUPABASE_URL || 'https://ifojeggpbgvvmdzcqpvo.supabase.co';
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_EMAIL = (env.ADMIN_SEED_EMAIL || 'admin@eduglobin.com').toLowerCase();

if (!SERVICE_KEY) {
  console.error('SUPABASE_SERVICE_ROLE_KEY missing in .env');
  process.exit(1);
}

console.log(`Connecting to Supabase at: ${SUPABASE_URL}`);
console.log(`Preserving Super Admin: ${ADMIN_EMAIL}`);

async function clearUsers() {
  const headers = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json'
  };

  // 1. List users from Supabase Auth Admin
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?per_page=100`, { headers });
  if (!res.ok) {
    console.error('Failed to list users:', res.status, await res.text());
    process.exit(1);
  }

  const data = await res.json();
  const users = data.users || [];
  console.log(`Found ${users.length} total users in Supabase Auth.`);

  let deletedCount = 0;
  for (const user of users) {
    const email = (user.email || '').toLowerCase();
    const role = user.user_metadata?.role || user.app_metadata?.role;

    if (email === ADMIN_EMAIL || role === 'SUPER_ADMIN') {
      console.log(`🛡️ Preserving Admin: ${email} (${user.id})`);
      continue;
    }

    console.log(`🗑️ Deleting user: ${email} (${role || 'NO_ROLE'}) [${user.id}]`);
    const delRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
      method: 'DELETE',
      headers
    });

    if (delRes.ok) {
      deletedCount++;
      console.log(`   ✓ Deleted ${email}`);
    } else {
      console.error(`   ✗ Failed to delete ${email}:`, await delRes.text());
    }
  }

  console.log(`\n✅ Completed clearing users: ${deletedCount} student/owner accounts removed.`);
}

clearUsers().catch(err => {
  console.error('Execution error:', err);
  process.exit(1);
});
