import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './styles/global.css';

const subPagePaths = new Set(['/about', '/classes', '/contacts', '/news', '/admin', '/login']);

function ensureTrailingSlashRoute() {
  const { pathname, search, hash } = window.location;
  if (!subPagePaths.has(pathname)) {
    return false;
  }

  window.location.replace(`${pathname}/${search}${hash}`);
  return true;
}

const componentRegistry = {
  header: {
    html: '/src/components/header/header.html',
    css: '/src/components/header/header.css',
    js: '/src/components/header/header.js'
  },
  footer: {
    html: '/src/components/footer/footer.html',
    css: '/src/components/footer/footer.css',
    js: '/src/components/footer/footer.js'
  }
};

function clearStaleBootstrapOverlays() {
  document.querySelectorAll('.modal-backdrop, .offcanvas-backdrop').forEach((element) => {
    element.remove();
  });

  document.body.classList.remove('modal-open', 'offcanvas-open');
  document.body.style.removeProperty('overflow');
  document.body.style.removeProperty('padding-right');
}

function hasVisibleBootstrapLayer() {
  const hasOpenModal = Boolean(document.querySelector('.modal.show'));
  const hasOpenOffcanvas = Boolean(document.querySelector('.offcanvas.show'));
  return hasOpenModal || hasOpenOffcanvas;
}

function installBootstrapOverlayGuard() {
  const cleanupIfStale = () => {
    if (!hasVisibleBootstrapLayer()) {
      clearStaleBootstrapOverlays();
    }
  };

  const observer = new MutationObserver(() => {
    cleanupIfStale();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style']
  });

  window.addEventListener('pageshow', cleanupIfStale);
  window.addEventListener('focus', cleanupIfStale);
  cleanupIfStale();
}

function ensureStylesheet(path) {
  if (!path || document.head.querySelector(`link[data-ui-style="${path}"]`)) {
    return;
  }

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = path;
  link.dataset.uiStyle = path;
  document.head.appendChild(link);
}

async function loadHtmlFragment(path, target) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Неуспешно зареждане на фрагмент: ${path}`);
  }

  target.innerHTML = await response.text();
}

async function loadComponent(name, target) {
  const definition = componentRegistry[name];
  if (!definition) {
    return;
  }

  ensureStylesheet(definition.css);
  await loadHtmlFragment(definition.html, target);

  const module = await import(definition.js);
  if (typeof module.init === 'function') {
    await module.init(target);
  }
}

async function loadPage(appElement) {
  const pageContent = document.getElementById('page-content');
  const pageHtml = appElement.dataset.pageComponent;
  const pageCss = appElement.dataset.pageCss;
  const pageJs = appElement.dataset.pageJs;

  ensureStylesheet(pageCss);
  await loadHtmlFragment(pageHtml, pageContent);

  const pageModule = await import(pageJs);
  if (typeof pageModule.init === 'function') {
    await pageModule.init(pageContent);
  }
}

async function bootstrapApp() {
  if (ensureTrailingSlashRoute()) {
    return;
  }

  installBootstrapOverlayGuard();

  clearStaleBootstrapOverlays();

  const appElement = document.getElementById('app');
  const componentSlots = appElement.querySelectorAll('[data-component]');

  for (const slot of componentSlots) {
    const componentName = slot.dataset.component;
    await loadComponent(componentName, slot);
  }

  await loadPage(appElement);

  clearStaleBootstrapOverlays();
}

bootstrapApp().catch((error) => {
  console.error(error);
});
