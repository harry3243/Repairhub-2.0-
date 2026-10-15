async function shopView(app, { args, params }) {
  const id = args[0], u = Auth.user, item = params.get('item') || '';
  const s = await api('/shops/' + id).catch(e => ({ error: e.message }));
  if (s.error) { app.innerHTML = `<div class="panel">${esc(s.error)} <a href="#/">Back to shops</a></div>`; return; }
  document.title = s.name + ' · repairhub';
  const maps = s.lat != null ? `https://www.google.com/maps/search/?api=1&query=${s.lat},${s.lng}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.address + ' ' + s.city)}`;
  const wa = waLink(s.phone, item ? `Hi, do you repair ${item}? Are you available today?` : 'Hi, I would like to check availability for a repair.');
  const isCustomer = u.role === 'customer';

  app.innerHTML = `
  <a class="back" href="#/">← All shops</a>
  <header class="shop-head">
    <div class="row-wrap"><span class="tag">${esc(groupLabel(s.grp))}</span>${statusHtml(s.open_now)}</div>
    <h1>${esc(s.name)}</h1>
    <p class="muted">${esc(s.description)}</p>
    <dl class="facts">
      <div><dt>Rating</dt><dd>${rating(s.rating, s.review_count || null)}</dd></div>
      <div><dt>Hours</dt><dd class="mono">${esc(s.open_time)}–${esc(s.close_time)}</dd></div>
      <div><dt>Address</dt><dd>${esc(s.address)}${s.city ? ', ' + esc(s.city) : ''}</dd></div>
    </dl>
    <div class="row-wrap">
      ${isCustomer ? '<button class="btn primary" id="goBook">Book a repair</button>' : ''}
      ${s.phone ? `<a class="btn" href="tel:${esc(s.phone)}">Call</a><a class="btn" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
      <a class="btn" href="${maps}" target="_blank" rel="noopener">Directions</a>
    </div>
  </header>

  <div class="cols">
    <div>
      <section class="panel"><h2>Repairs these items</h2>
        ${s.handles.length ? `<div class="tags">${s.handles.map(h => `<span class="tag ${item && h.toLowerCase().includes(item.toLowerCase()) ? 'ok' : ''}">${esc(h)}</span>`).join('')}</div>`
          : '<p class="empty">This shop has not listed what it repairs yet.</p>'}
      </section>

      <section class="panel"><h2>Repairs and prices</h2>
        ${s.services.length ? `<ul class="list">${s.services.map(v => `<li class="item">
          <div class="item-main">${esc(v.name)}<div class="muted small">about ${v.est_minutes} min</div></div>
          <div class="item-val">₹${v.price_min} – ₹${v.price_max}</div></li>`).join('')}</ul>` : '<p class="empty">No prices listed. Ask the shop for a quote.</p>'}
        <p class="muted small" style="margin-top:.7rem">Final price is confirmed after the technician inspects the device.</p>
      </section>

      <section class="panel"><h2>Spare parts</h2>
        ${s.spares.length ? `<ul class="list">${s.spares.map(p => `<li class="item">
          <div class="item-main">${esc(p.name)}<div class="muted small">${esc(p.compatible_with)}</div></div>
          <div class="item-val">₹${p.price}<div><span class="tag ${p.stock > 0 ? 'ok' : 'bad'}">${p.stock > 0 ? p.stock + ' in stock' : 'out of stock'}</span></div></div></li>`).join('')}</ul>` : '<p class="empty">No spare parts listed.</p>'}
      </section>

      <section class="panel"><h2>Reviews</h2>
        ${s.reviews.length ? `<ul class="list">${s.reviews.map(r => `<li class="item"><div class="item-main"><b>${esc(r.user_name)}</b> <span class="mono">★ ${r.rating}</span>
          <div>${esc(r.comment)}</div></div></li>`).join('')}</ul>` : '<p class="empty">No reviews yet. Be the first.</p>'}
        ${isCustomer ? `<hr>
        <form id="rf" class="row-wrap">
          <select id="rate" class="w-sm" aria-label="Rating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${n} ★</option>`).join('')}</select>
          <input id="rcomment" placeholder="How was your repair?" aria-label="Review" style="flex:1;min-width:180px">
          <button class="btn">Post review</button>
        </form>` : ''}
      </section>
    </div>

    <div>
      ${isCustomer ? `<section class="panel" id="avail"><h2>Check availability</h2>
        <p class="muted small" style="margin-bottom:.7rem">Ask before you travel. The shop replies with yes or no and a rough price.</p>
        <form id="ef">
          <div class="field"><label for="eitem">What needs repair?</label><input id="eitem" placeholder="e.g. hair dryer"></div>
          <div class="field"><label for="emsg">Message</label><textarea id="emsg" rows="2">Are you available today? Rough price and time?</textarea></div>
          <button class="btn primary block">Send enquiry</button>
        </form>
        <p class="muted small" style="margin-top:.6rem">Prefer to talk? Use Call or WhatsApp above.</p>
      </section>` : ''}

      <section class="panel"><h2>Ask about your repair</h2>
        <p class="muted small" style="margin-bottom:.6rem">Try: “Do you repair a hair dryer? How much?”</p>
        <div class="chat"><div class="log" id="log" aria-live="polite"></div>
          <form id="cf"><input id="msg" placeholder="Type your question" aria-label="Your question" autocomplete="off"><button class="btn">Ask</button></form></div>
      </section>

      ${isCustomer ? `<section class="panel" id="book"><h2>Book this shop</h2>
        <form id="bf">
          <div class="field"><label for="bsvc">Repair needed</label><select id="bsvc"><option value="">Not sure / other</option>
            ${s.services.map(v => `<option value="${v.id}">${esc(v.name)} (from ₹${v.price_min})</option>`).join('')}</select></div>
          <div class="field"><label for="bdev">Device or vehicle</label><input id="bdev" placeholder="e.g. iPhone 11, Honda Activa"></div>
          <div class="field"><label for="bissue">What is wrong?</label><textarea id="bissue" rows="2"></textarea></div>
          <div class="field"><label for="bslot">Preferred time</label><input id="bslot" type="datetime-local"></div>
          <button class="btn primary block">Send booking request</button></form>
      </section>` : ''}
    </div>
  </div>`;

  const $ = (x) => document.getElementById(x);
  const log = $('log');
  const bubble = (who, text, sugg) => {
    const b = document.createElement('div'); b.className = 'bubble ' + who; b.textContent = text;
    if (sugg && sugg.length) {
      const d = document.createElement('div'); d.className = 'sugg';
      sugg.forEach(x => { const a = document.createElement('a'); a.href = `#/shop/${x.id}` + (item ? `?item=${encodeURIComponent(item)}` : ''); a.textContent = `${x.name} · ${x.open_now ? 'open now' : 'closed now'}`; d.appendChild(a); });
      b.appendChild(d);
    }
    log.appendChild(b); log.scrollTop = log.scrollHeight;
  };
  bubble('bot', 'Hi! Ask me if this shop repairs your item, what it costs, or whether a part is in stock.');
  if ($('eitem')) $('eitem').value = item;

  if ($('goBook')) $('goBook').onclick = () => $('book').scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('cf').onsubmit = async (e) => {
    e.preventDefault();
    const m = $('msg').value.trim(); if (!m) return;
    $('msg').value = ''; bubble('me', m);
    try { const r = await api('/chat', { method: 'POST', body: { shop_id: s.id, message: m } }); bubble('bot', r.reply, r.suggestions); }
    catch (err) { bubble('bot', err.message); }
  };
  if ($('ef')) $('ef').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/enquiries', { method: 'POST', body: { shop_id: s.id, item: $('eitem').value, message: $('emsg').value } });
      toast('Enquiry sent. The reply will appear under My bookings.');
      $('eitem').value = '';
    } catch (err) { toast(err.message, true); }
  };
  if ($('bf')) $('bf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/bookings', { method: 'POST', body: { shop_id: s.id, service_id: $('bsvc').value || null,
        device: $('bdev').value.trim(), issue: $('bissue').value.trim(), slot: $('bslot').value } });
      toast('Booking sent. You can pay once the shop accepts it.');
      location.hash = '#/dashboard';
    } catch (err) { toast(err.message, true); }
  };
  if ($('rf')) $('rf').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api(`/shops/${s.id}/reviews`, { method: 'POST', body: { rating: $('rate').value, comment: $('rcomment').value } });
      toast('Review saved.'); shopView(app, { args, params });
    } catch (err) { toast(err.message, true); }
  };
}
