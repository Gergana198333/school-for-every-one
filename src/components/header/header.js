import { supabase } from '../../supabaseClient';

const ADMIN_EMAILS = String(import.meta.env.VITE_ADMIN_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

const QUICK_LOGIN_MAP = String(import.meta.env.VITE_QUICK_LOGIN_MAP ?? '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .reduce((acc, entry) => {
    const [rawCode, rawPayload] = entry.includes('=') ? entry.split('=') : entry.split(':', 2);
    const code = String(rawCode ?? '').trim().toUpperCase();
    const payload = String(rawPayload ?? '').trim();

    if (!code || !payload) {
      return acc;
    }

    const payloadParts = payload.split('|').map((part) => part.trim());
    const email = String(payloadParts[0] ?? '').toLowerCase();
    if (!email.includes('@')) {
      return acc;
    }

    acc[code] = {
      email,
      authPassword: payloadParts[1] || null,
      quickPassword: payloadParts[2] || null
    };

    return acc;
  }, {});

function normalizePath(path) {
  if (!path || path === '/') {
    return '/';
  }

  return path.endsWith('/') ? path.slice(0, -1) : path;
}

function getSearchTarget(query) {
  const normalized = query.toLowerCase();

  if (/клас|урок|обуч|lesson|class|ученик/.test(normalized)) {
    return '/classes/';
  }

  if (/новин|събит|event|news/.test(normalized)) {
    return '/news/';
  }

  if (/контакт|въпрос|домашн|teacher|родител|contact/.test(normalized)) {
    return '/contacts/';
  }

  if (/admin|админ|управление|dashboard/.test(normalized)) {
    return '/admin/';
  }

  if (/вход|логин|login|sign/.test(normalized)) {
    return '/login/';
  }

  if (/училищ|за нас|мисия|about/.test(normalized)) {
    return '/about/';
  }

  return '/';
}

function updateAuthControls(root, session) {
  const loginLink = root.querySelector('#header-login-link');
  const quickLoginToggle = root.querySelector('#header-quick-login-toggle');
  const quickLoginWrap = root.querySelector('#header-quick-login-wrap');
  const logoutButton = root.querySelector('#header-logout-btn');
  const isLoggedIn = Boolean(session?.user);

  loginLink?.classList.toggle('d-none', isLoggedIn);
  quickLoginToggle?.classList.toggle('d-none', isLoggedIn);
  logoutButton?.classList.toggle('d-none', !isLoggedIn);

  if (isLoggedIn) {
    quickLoginWrap?.classList.add('d-none');
  }
}

function setQuickLoginMessage(root, text, variant = 'neutral') {
  const message = root.querySelector('#header-quick-login-message');
  if (!message) {
    return;
  }

  message.textContent = text;
  message.classList.remove('text-danger', 'text-success');

  if (variant === 'error') {
    message.classList.add('text-danger');
    return;
  }

  if (variant === 'success') {
    message.classList.add('text-success');
  }
}

function buildQuickLoginCodeCandidates(codeRaw) {
  const normalized = String(codeRaw ?? '').trim();
  if (!normalized) {
    return [];
  }

  const upper = normalized.toUpperCase().replace(/\s+/g, '');
  const candidates = new Set([upper]);

  if (upper.includes('UR')) {
    candidates.add(upper.replace('UR', 'RU'));
  }

  if (upper.includes('RU')) {
    candidates.add(upper.replace('RU', 'UR'));
  }

  const simpleCodeMatch = upper.match(/^(\d+)U(\d+)$/);
  if (simpleCodeMatch) {
    const grade = simpleCodeMatch[1];
    const studentNumber = simpleCodeMatch[2];
    candidates.add(`${grade}RU${studentNumber}`);
    candidates.add(`${grade}UR${studentNumber}`);
  }

  return Array.from(candidates);
}

function resolveQuickLoginEntry(codeRaw) {
  const normalized = String(codeRaw ?? '').trim();
  if (!normalized) {
    return null;
  }

  if (normalized.includes('@')) {
    return {
      email: normalized.toLowerCase(),
      authPassword: null,
      quickPassword: null
    };
  }

  const candidates = buildQuickLoginCodeCandidates(normalized);

  for (const code of candidates) {
    const mappedEntry = QUICK_LOGIN_MAP[code];
    if (mappedEntry?.email) {
      return mappedEntry;
    }
  }

  return null;
}

async function resolveQuickLoginFromDatabase(code, password) {
  const normalizedPassword = String(password ?? '');
  const codeCandidates = buildQuickLoginCodeCandidates(code);

  if (!codeCandidates.length || !normalizedPassword) {
    return null;
  }

  for (const candidateCode of codeCandidates) {
    const { data, error } = await supabase.rpc('resolve_quick_login', {
      p_code: candidateCode,
      p_password: normalizedPassword
    });

    if (error) {
      console.warn('Quick login RPC error:', error.message);
      continue;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const email = String(row?.login_email ?? '').trim().toLowerCase();

    if (!email) {
      continue;
    }

    return {
      email,
      authPassword: normalizedPassword,
      quickPassword: null
    };
  }

  return null;
}

function getUserRedirectByEmail(email) {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (ADMIN_EMAILS.includes(normalized)) {
    return '/admin/';
  }

  return '/classes/';
}

export async function init(root) {
  const currentPath = normalizePath(window.location.pathname);
  const links = root.querySelectorAll('.nav-link');

  links.forEach((link) => {
    const linkPath = normalizePath(new URL(link.href, window.location.origin).pathname);
    const isActive = linkPath === currentPath;
    link.classList.toggle('active', isActive);
    link.setAttribute('aria-current', isActive ? 'page' : 'false');
  });

  const searchForm = root.querySelector('#header-search-form');
  const searchInput = root.querySelector('.header-search-input');
  const currentQuery = new URLSearchParams(window.location.search).get('q');

  if (currentQuery && searchInput) {
    searchInput.value = currentQuery;
  }

  searchForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = searchInput?.value.trim();

    if (!query) {
      return;
    }

    const targetPath = getSearchTarget(query);
    const params = new URLSearchParams({ q: query });
    window.location.href = `${targetPath}?${params.toString()}`;
  });

  const logoutButton = root.querySelector('#header-logout-btn');
  const quickLoginToggle = root.querySelector('#header-quick-login-toggle');
  const quickLoginWrap = root.querySelector('#header-quick-login-wrap');
  const quickLoginForm = root.querySelector('#header-quick-login-form');
  const quickLoginCodeInput = root.querySelector('#header-quick-login-code');
  const quickLoginPasswordInput = root.querySelector('#header-quick-login-password');

  logoutButton?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login/';
  });

  quickLoginToggle?.addEventListener('click', () => {
    quickLoginWrap?.classList.toggle('d-none');
    setQuickLoginMessage(root, '');
  });

  quickLoginForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const schoolCode = String(quickLoginCodeInput?.value ?? '').trim();
    const password = String(quickLoginPasswordInput?.value ?? '');

    if (!schoolCode || !password) {
      setQuickLoginMessage(root, 'Попълнете номер от училището и парола.', 'error');
      return;
    }

    const databaseEntry = await resolveQuickLoginFromDatabase(schoolCode, password);
    const quickEntry = databaseEntry ?? resolveQuickLoginEntry(schoolCode);
    if (!quickEntry?.email) {
      setQuickLoginMessage(root, 'Номерът не е конфигуриран за бърз вход. Ползвайте страницата Вход.', 'error');
      return;
    }

    if (quickEntry.quickPassword && quickEntry.quickPassword !== password) {
      setQuickLoginMessage(root, 'Грешни данни за вход.', 'error');
      return;
    }

    const authPassword = quickEntry.authPassword || password;

    setQuickLoginMessage(root, 'Влизане...');
    const { error } = await supabase.auth.signInWithPassword({ email: quickEntry.email, password: authPassword });
    if (error) {
      setQuickLoginMessage(root, 'Грешни данни за вход.', 'error');
      return;
    }

    setQuickLoginMessage(root, 'Успешен вход.', 'success');
    window.location.href = getUserRedirectByEmail(quickEntry.email);
  });

  const { data: sessionData } = await supabase.auth.getSession();
  updateAuthControls(root, sessionData?.session ?? null);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthControls(root, session);
  });
}
