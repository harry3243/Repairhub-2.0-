// Tiny hash router: #/login  #/  #/shop/3  #/dashboard   (login comes first)
const routes = [
  [/^\/$/, homeView],
  [/^\/shop\/(\d+)$/, shopView],
  [/^\/login$/, loginView],
  [/^\/dashboard$/, dashboardView],
];

async function route() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  const params = new URLSearchParams(qs || '');
  const app = document.getElementById('app');
  const u = Auth.user;
  if (!u && path !== '/login') { location.hash = '#/login'; return; }          // not logged in: login first
  if (u && path === '/login') { location.hash = u.role === 'owner' ? '#/dashboard' : '#/'; return; }
  for (const [re, view] of routes) {
    const m = path.match(re);
    if (m) {
      document.title = 'repairhub · find repair shops near you';
      try { await view(app, { args: m.slice(1), params }); }
      catch (e) { app.innerHTML = `<div class="panel">${esc(e.message)}</div>`; }
      markActive();
      return;
    }
  }
  app.innerHTML = '<div class="panel">Page not found. <a href="#/">Back to shops</a></div>';
}

window.addEventListener('hashchange', () => { if (window.closeMenus) window.closeMenus(); window.scrollTo(0, 0); route(); });
(async () => { if (Auth.token) await loadMeta(); renderHeader(); renderFooter(); route(); })();
