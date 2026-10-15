// Shared helpers used by every view
const _mem = {};
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return _mem[k] ?? null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { _mem[k] = v; } },
  del(k) { try { localStorage.removeItem(k); } catch { delete _mem[k]; } },
};
const Auth = {
  get token() { return store.get('rh_token'); },
  get user() { try { return JSON.parse(store.get('rh_user')); } catch { return null; } },
  save(d) { store.set('rh_token', d.token); store.set('rh_user', JSON.stringify(d.user)); },
  clear() { store.del('rh_token'); store.del('rh_user'); },
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(Auth.token ? { Authorization: 'Bearer ' + Auth.token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && Auth.token) {
      Auth.clear();
      if (typeof renderHeader === 'function') renderHeader();
      if (location.hash !== '#/login') location.hash = '#/login';
    }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

function toast(msg, isErr) {
  document.querySelectorAll('.toast').forEach(x => x.remove());
  const t = document.createElement('div');
  t.className = 'toast' + (isErr ? ' err' : '');
  t.setAttribute('role', 'status');
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Groups and repair types come from the server (/api/meta) so there is one list to maintain.
let META = { groups: [] };
async function loadMeta() { try { META = await api('/meta'); } catch { /* login redirect handles it */ } }
const groupLabel = (k) => (META.groups.find(g => g.key === k) || {}).label || k;
const typeLabel = (k) => { for (const g of META.groups) { const t = g.types.find(x => x.key === k); if (t) return t.label; } return k; };
const digits = (p) => String(p || '').replace(/\D/g, '');
const waLink = (phone, text) => `https://wa.me/${digits(phone)}?text=${encodeURIComponent(text)}`;
const rating = (r, n) => r ? `<span class="mono">★ ${r}</span>${n != null ? ` <span class="muted small">(${n})</span>` : ''}` : '<span class="muted small">No reviews yet</span>';
const statusHtml = (open) => `<span class="status ${open ? 'ok' : 'bad'}"><i class="dot"></i>${open ? 'Open now' : 'Closed'}</span>`;
