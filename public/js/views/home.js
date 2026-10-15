const homeState = { q: '', open: false, lat: null, lng: null };

function shopCard(s, item) {
  const href = `#/shop/${s.id}` + (item ? `?item=${encodeURIComponent(item)}` : '');
  const wa = waLink(s.phone, item ? `Hi, do you repair ${item}? Are you available today?` : 'Hi, I would like to check availability for a repair.');
  const badge = s.match === 'exact' && s.matched_item ? `<span class="tag ok">repairs ${esc(s.matched_item)}</span>`
    : s.match === 'related' && s.matched_item ? `<span class="tag">may handle ${esc(s.matched_item)}</span>` : '';
  return `<article class="card">
    <a class="card-main" href="${href}">
      <div class="card-top"><span class="tag">${esc(groupLabel(s.grp))}</span>${statusHtml(s.open_now)}</div>
      <h3>${esc(s.name)}</h3>
      ${badge ? `<div>${badge}</div>` : ''}
      <div>${rating(s.rating, s.review_count || null)}</div>
      <p class="muted small">${esc(s.address)}${s.distance_km != null ? ` · ${s.distance_km} km` : ''}</p>
      <div class="card-foot"><span class="price">${s.from_price != null ? 'from ₹' + s.from_price : 'ask for price'}</span><span class="muted">${esc(s.open_time)}–${esc(s.close_time)}</span></div>
    </a>
    <div class="card-actions">
      ${s.phone ? `<a class="btn sm" href="tel:${esc(s.phone)}">Call</a><a class="btn sm" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      <a class="btn sm" href="${href}">Check availability</a>
    </div></article>`;
}

async function homeView(app, { params }) {
  const group = params.get('g') || '', type = params.get('t') || '';
  const g = META.groups.find(x => x.key === group);
  app.innerHTML = `
  <section class="intro">
    <h1>What needs fixing?</h1>
    <p class="muted">Search any device or vehicle. You will only see shops that repair it, with live availability.</p>
    <form class="search" id="sf" role="search">
      <input type="search" id="q" placeholder="e.g. hair dryer, fridge, Activa brake, iPhone 11 screen" aria-label="What needs repair">
      <button class="btn primary">Search</button>
    </form>
  </section>
  <div class="filterbar">
    <nav class="seg" aria-label="Category">
      <a href="#/" class="${!group ? 'on' : ''}">All</a>
      ${META.groups.map(x => `<a href="#/?g=${x.key}" class="${group === x.key ? 'on' : ''}">${esc(x.label)}</a>`).join('')}
    </nav>
    <div class="opts">
      <label class="switch"><input type="checkbox" id="openOnly"><span class="track"></span><span>Open now</span></label>
      <button class="btn sm" id="near" type="button">Nearest first</button>
    </div>
    ${g ? `<div class="chips" aria-label="Type of repair">
      <a class="chip ${!type ? 'on' : ''}" href="#/?g=${g.key}">All ${esc(g.label.toLowerCase())}</a>
      ${g.types.map(t => `<a class="chip ${type === t.key ? 'on' : ''}" href="#/?g=${g.key}&t=${t.key}">${esc(t.label)}</a>`).join('')}
    </div>` : ''}
  </div>
  <div class="meta muted" id="count" aria-live="polite">Loading…</div>
  <div id="results"></div>`;

  const $ = (id) => document.getElementById(id);
  $('q').value = homeState.q;
  $('openOnly').checked = homeState.open;
  $('near').classList.toggle('on', homeState.lat != null);

  async function load() {
    const p = new URLSearchParams();
    if (group) p.set('group', group);
    if (type) p.set('type', type);
    if (homeState.q) p.set('q', homeState.q);
    if (homeState.open) p.set('open', '1');
    if (homeState.lat != null) { p.set('lat', homeState.lat); p.set('lng', homeState.lng); }
    try {
      const r = await api('/shops?' + p);
      const exact = r.shops.filter(s => s.match === 'exact'), related = r.shops.filter(s => s.match === 'related');
      const label = r.item || r.q;
      $('count').innerHTML = r.q
        ? `${exact.length} shop${exact.length === 1 ? ' repairs' : 's repair'} <b>${esc(label)}</b>${r.item && r.item.toLowerCase() !== r.q.toLowerCase() ? ` <span class="muted">(you searched “${esc(r.q)}”)</span>` : ''}${homeState.lat != null ? ', nearest first' : ''}`
        : `${exact.length} shop${exact.length === 1 ? '' : 's'}${homeState.lat != null ? ', nearest first' : ''}`;

      let html = exact.length ? `<div class="cards">${exact.map(s => shopCard(s, r.item || r.q)).join('')}</div>` : '';
      if (!exact.length) {
        const canAsk = Auth.user.role === 'customer' && related.length;
        html += `<div class="empty-state"><p>${r.q ? `No shop lists <b>${esc(label)}</b> repair yet.` : 'No shops match these filters.'}</p>
          ${canAsk ? `<p class="muted small">${related.length} shop${related.length === 1 ? '' : 's'} in the same category might still handle it. Send them all one message and compare replies.</p>
          <button class="btn primary" id="askAll">Ask ${related.length} shop${related.length === 1 ? '' : 's'}</button>` : '<p class="muted small">Try a different word, or choose a category above.</p>'}</div>`;
      }
      if (related.length) html += `<h2 class="sec">Might handle it, ask first</h2><div class="cards">${related.map(s => shopCard(s, r.item || r.q)).join('')}</div>`;
      $('results').innerHTML = html;
      const ask = $('askAll');
      if (ask) ask.onclick = async () => {
        ask.disabled = true;
        try {
          const x = await api('/enquiries', { method: 'POST', body: { shop_ids: related.map(s => s.id), item: label,
            message: `Do you repair ${label}? Please reply with availability and a rough price.` } });
          toast(`Sent to ${x.sent} shop${x.sent === 1 ? '' : 's'}. Replies appear under My bookings.`);
        } catch (e) { toast(e.message, true); ask.disabled = false; }
      };
    } catch (e) { $('count').textContent = ''; $('results').innerHTML = `<div class="panel">${esc(e.message)}</div>`; }
  }

  $('sf').onsubmit = (e) => { e.preventDefault(); homeState.q = $('q').value.trim(); load(); };
  $('openOnly').onchange = (e) => { homeState.open = e.target.checked; load(); };
  $('near').onclick = () => {
    if (homeState.lat != null) { homeState.lat = homeState.lng = null; $('near').classList.remove('on'); return load(); }
    if (!navigator.geolocation) return toast('Your browser does not support location.', true);
    navigator.geolocation.getCurrentPosition(
      pos => { homeState.lat = pos.coords.latitude; homeState.lng = pos.coords.longitude; $('near').classList.add('on'); load(); },
      () => toast('Location is blocked. Allow it in your browser to sort by distance.', true));
  };
  load();
}
