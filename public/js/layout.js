// Header: logo, simple nav (Electronics / Automobiles), theme toggle, login state. Footer.
function renderHeader() {
  const u = Auth.user;
  document.getElementById('hdr').innerHTML = `
  <header class="site-header"><div class="bar">
    <a class="logo" href="${u ? '#/' : '#/login'}"><span class="mark">⌁</span>repairhub</a>
    <div class="actions">
      <button class="btn sm" id="themeBtn" aria-label="Switch colour theme" title="Switch theme">◐</button>
      ${u ? `<span class="user-name">${esc(u.name)}</span><button class="btn sm" id="logoutBtn">Log out</button>
             <button class="btn sm menu-btn" id="menuBtn" aria-expanded="false" aria-controls="nav">Menu</button>` : ''}
    </div>
    ${u ? `<nav class="nav" id="nav" aria-label="Main">
      <a class="nav-link" href="#/" data-key="home">Find shops</a>
      <a class="nav-link" href="#/?g=electronics" data-key="electronics">Electronics</a>
      <a class="nav-link" href="#/?g=automobile" data-key="automobile">Automobiles</a>
      <a class="nav-link" href="#/dashboard" data-key="dashboard">${u.role === 'owner' ? 'My shop' : 'My bookings'}</a>
    </nav>` : ''}
  </div></header>`;

  const nav = document.getElementById('nav'), menuBtn = document.getElementById('menuBtn');
  window.closeMenus = () => { if (nav) nav.classList.remove('open'); if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false'); };
  if (menuBtn) {
    menuBtn.onclick = () => { const o = nav.classList.toggle('open'); menuBtn.setAttribute('aria-expanded', o); };
    nav.querySelectorAll('a').forEach(a => a.addEventListener('click', window.closeMenus));
  }
  if (!window._escBound) { window._escBound = true; document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeMenus && window.closeMenus(); }); }

  document.getElementById('themeBtn').onclick = () => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    store.set('rh_theme', next);
  };
  const lo = document.getElementById('logoutBtn');
  if (lo) lo.onclick = () => { Auth.clear(); renderHeader(); location.hash = '#/login'; };
  markActive();
}

function markActive() {
  const raw = location.hash.slice(1) || '/', [path, qs] = raw.split('?'), g = new URLSearchParams(qs || '').get('g');
  const key = path === '/dashboard' ? 'dashboard' : path === '/' ? (g || 'home') : '';
  document.querySelectorAll('#nav a[data-key]').forEach(a => a.classList.toggle('active', a.dataset.key === key));
}

function renderFooter() { document.getElementById('ftr').textContent = 'repairhub · Symbiosys Technology'; }
