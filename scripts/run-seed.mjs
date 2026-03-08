// Wrapper to run seed-beaches via ts-node
// Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your environment or .env before running:
//   export SUPABASE_URL=https://xxx.supabase.co
//   export SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
import { execSync } from 'child_process';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars');
  process.exit(1);
}

execSync(
  'npx ts-node --compiler-options "{\\"module\\":\\"CommonJS\\"}" scripts/seed-beaches.ts',
  { stdio: 'inherit', cwd: process.cwd() }
);
