import { supabase } from '../../supabaseClient';

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
  const logoutButton = root.querySelector('#header-logout-btn');
  const isLoggedIn = Boolean(session?.user);

  loginLink?.classList.toggle('d-none', isLoggedIn);
  logoutButton?.classList.toggle('d-none', !isLoggedIn);
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

  logoutButton?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/login/';
  });

  const { data: sessionData } = await supabase.auth.getSession();
  updateAuthControls(root, sessionData?.session ?? null);

  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthControls(root, session);
  });
}
