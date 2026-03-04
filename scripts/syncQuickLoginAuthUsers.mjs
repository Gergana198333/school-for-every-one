import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function parseDotEnv(content) {
  const entries = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) {
      continue;
    }

    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function loadEnvironment() {
  const envFilePath = path.join(rootDir, '.env');
  let fileEntries = {};

  if (fs.existsSync(envFilePath)) {
    const envContent = fs.readFileSync(envFilePath, 'utf8');
    fileEntries = parseDotEnv(envContent);
  }

  return {
    SUPABASE_URL:
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      fileEntries.VITE_SUPABASE_URL ||
      fileEntries.SUPABASE_URL ||
      '',
    SUPABASE_SERVICE_ROLE_KEY:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      fileEntries.SUPABASE_SERVICE_ROLE_KEY ||
      ''
  };
}

async function fetchQuickLogins(adminClient) {
  const [{ data: studentCodes, error: studentError }, { data: parentCodes, error: parentError }] = await Promise.all([
    adminClient
      .from('student_quick_login_codes')
      .select('code, login_email, quick_password, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true }),
    adminClient
      .from('parent_quick_login_codes')
      .select('code, login_email, quick_password, is_active')
      .eq('is_active', true)
      .order('code', { ascending: true })
  ]);

  if (studentError) {
    throw new Error(`Неуспешно четене на student_quick_login_codes: ${studentError.message}`);
  }

  if (parentError) {
    throw new Error(`Неуспешно четене на parent_quick_login_codes: ${parentError.message}`);
  }

  const normalize = (row, role) => ({
    role,
    code: String(row?.code ?? '').trim().toUpperCase(),
    email: String(row?.login_email ?? '').trim().toLowerCase(),
    password: String(row?.quick_password ?? '')
  });

  const studentRows = (studentCodes ?? []).map((row) => normalize(row, 'student'));
  const parentRows = (parentCodes ?? []).map((row) => normalize(row, 'parent'));

  return [...studentRows, ...parentRows]
    .filter((row) => row.code && row.email && row.password)
    .filter((row) => row.email.includes('@'));
}

async function getAllAuthUsers(adminClient) {
  const usersByEmail = new Map();
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw new Error(`Неуспешно четене на Auth users: ${error.message}`);
    }

    const users = data?.users ?? [];
    for (const user of users) {
      const email = String(user?.email ?? '').trim().toLowerCase();
      if (email) {
        usersByEmail.set(email, user);
      }
    }

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return usersByEmail;
}

async function upsertAuthUser(adminClient, existingUser, entry) {
  if (!existingUser) {
    const { data, error } = await adminClient.auth.admin.createUser({
      email: entry.email,
      password: entry.password,
      email_confirm: true,
      user_metadata: {
        role: entry.role,
        school_code: entry.code,
        quick_login: true
      }
    });

    if (error) {
      throw new Error(`Create user failed for ${entry.email}: ${error.message}`);
    }

    return { action: 'created', userId: data?.user?.id ?? null };
  }

  const existingMetadata = existingUser.user_metadata ?? {};

  const { data, error } = await adminClient.auth.admin.updateUserById(existingUser.id, {
    password: entry.password,
    email_confirm: true,
    user_metadata: {
      ...existingMetadata,
      role: entry.role,
      school_code: entry.code,
      quick_login: true
    }
  });

  if (error) {
    throw new Error(`Update user failed for ${entry.email}: ${error.message}`);
  }

  return { action: 'updated', userId: data?.user?.id ?? existingUser.id };
}

async function main() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = loadEnvironment();

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'Липсват SUPABASE_URL/VITE_SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY. Добави ги в .env или environment variables.'
    );
  }

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const quickLogins = await fetchQuickLogins(adminClient);
  if (quickLogins.length === 0) {
    console.log('Няма активни quick login записи за синхронизиране.');
    return;
  }

  const usersByEmail = await getAllAuthUsers(adminClient);

  let created = 0;
  let updated = 0;

  for (const entry of quickLogins) {
    const existingUser = usersByEmail.get(entry.email);
    const result = await upsertAuthUser(adminClient, existingUser, entry);

    if (result.action === 'created') {
      created += 1;
    } else {
      updated += 1;
    }

    console.log(`${result.action.toUpperCase()}: ${entry.code} -> ${entry.email}`);
  }

  console.log(`Готово. Създадени: ${created}, обновени: ${updated}, общо: ${quickLogins.length}.`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
