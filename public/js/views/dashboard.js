const whenText = (s) => (s ? s.replace('T', ' ') : 'any time');
const bookTag = (b) => `<span class="tag ${['rejected', 'cancelled'].includes(b.status) ? 'bad' : b.status === 'pending' ? '' : 'ok'}">${b.status}${b.payment_status === 'paid' ? ' · paid' : ''}</span>`;

async function dashboardView(app) {
  const u = Auth.user;
  return u.role === 'owner' ? ownerDash(app) : customerDash(app);
}

/* ---------------- customer ---------------- */
async function customerDash(app) {
  const [rows, enq] = await Promise.all([api('/bookings/mine'), api('/enquiries/mine')]);
  app.innerHTML = `<h1 style="margin-bottom:1rem">My bookings</h1>

  <section class="panel"><h2>Availability enquiries</h2>
    ${enq.length ? `<ul class="list">${enq.map(e => {
      const t = e.status === 'open' ? '<span class="tag">waiting for reply</span>'
        : e.available ? '<span class="tag ok">available</span>' : '<span class="tag bad">not available</span>';
      const wa = waLink(e.shop_phone, `Hi, about my enquiry for ${e.item}.`);
      return `<li class="item"><div class="item-main"><a href="#/shop/${e.shop_id}">${esc(e.shop_name)}</a> · <b>${esc(e.item)}</b>
        <div class="muted small">${esc(e.message)}</div>${e.reply ? `<div>“${esc(e.reply)}”</div>` : ''}</div>
        <div class="item-actions">${t}${e.shop_phone ? `<a class="btn sm" href="tel:${esc(e.shop_phone)}">Call</a><a class="btn sm" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : ''}</div></li>`;
    }).join('')}</ul>` : '<p class="empty">No enquiries yet. Open a shop and tap “Send enquiry”, or search for an item and ask several shops at once.</p>'}
  </section>

  <section class="panel"><h2>Repair bookings</h2>${rows.length ? `<ul class="list">${rows.map(b => `<li class="item">
    <div class="item-main"><a href="#/shop/${b.shop_id}">${esc(b.shop_name)}</a>
      <div>${esc(b.service_name || 'General repair')} · ${esc(b.device)}</div>
      <div class="muted small">${esc(whenText(b.slot))}</div></div>
    <div class="item-val">₹${b.amount}<div>${bookTag(b)}</div></div>
    <div class="item-actions">
      ${b.payment_status === 'unpaid' && ['accepted', 'completed'].includes(b.status) ? `<button class="btn sm primary" data-pay="${b.id}">Pay ₹${b.amount}</button>` : ''}
      ${['pending', 'accepted'].includes(b.status) && b.payment_status === 'unpaid' ? `<button class="btn sm" data-cancel="${b.id}">Cancel</button>` : ''}
    </div></li>`).join('')}</ul>`
    : '<p class="empty">No bookings yet. <a href="#/">Find a shop</a> to book your first repair.</p>'}</section>`;

  app.querySelectorAll('[data-pay]').forEach(b => b.onclick = async () => {
    try {
      const c = await api('/payments/checkout', { method: 'POST', body: { booking_id: +b.dataset.pay } });
      // Mock provider: confirm straight away. With Razorpay, open its checkout here and call /confirm in its success handler.
      await api('/payments/confirm', { method: 'POST', body: { payment_id: c.payment_id } });
      toast('Payment received.'); customerDash(app);
    } catch (e) { toast(e.message, true); }
  });
  app.querySelectorAll('[data-cancel]').forEach(b => b.onclick = async () => {
    try { await api(`/bookings/${b.dataset.cancel}/status`, { method: 'PATCH', body: { status: 'cancelled' } }); customerDash(app); }
    catch (e) { toast(e.message, true); }
  });
}

/* ---------------- owner ---------------- */
async function ownerDash(app) {
  const shop = await api('/shops/mine/info');
  if (!shop) return shopForm(app, null);
  const [bookings, enq] = await Promise.all([api('/bookings/shop'), api('/enquiries/shop')]);
  const openEnq = enq.filter(e => e.status === 'open').length;
  const pending = bookings.filter(b => b.status === 'pending').length;
  const out = shop.spares.filter(p => p.stock <= 0).length;

  app.innerHTML = `
  <div class="row-wrap between" style="margin-bottom:1rem">
    <div><h1>${esc(shop.name)}</h1><span class="muted small mono">${esc(groupLabel(shop.grp))} · ${esc(shop.open_time)}–${esc(shop.close_time)}</span></div>
    <div class="row-wrap">
      <label class="switch"><input type="checkbox" id="avail" ${shop.is_open ? 'checked' : ''}><span class="track"></span><span>Accepting customers</span></label>
      <button class="btn sm" id="editShop">Edit details</button>
    </div>
  </div>
  <div class="stats">
    <div class="stat"><b>${openEnq}</b><span>open enquiries</span></div>
    <div class="stat"><b>${pending}</b><span>pending bookings</span></div>
    <div class="stat"><b>${out}</b><span>parts out of stock</span></div>
  </div>

  <section class="panel"><h2>Availability enquiries</h2>
    ${enq.length ? `<ul class="list">${enq.map(e => `<li class="item">
      <div class="item-main"><b>${esc(e.customer_name)}</b> asks about <b>${esc(e.item)}</b>
        <div class="muted small">${esc(e.message)}</div>
        ${e.status === 'replied' ? `<div>You replied: <span class="tag ${e.available ? 'ok' : 'bad'}">${e.available ? 'available' : 'not available'}</span> ${esc(e.reply)}</div>` : ''}</div>
      ${e.status === 'open' ? `<div class="item-actions" style="flex:1 1 260px">
        <input data-note="${e.id}" placeholder="Note, e.g. bring it today, about ₹300" aria-label="Reply note" style="flex:1;min-width:160px">
        <button class="btn sm primary" data-av="1" data-id="${e.id}">Available</button>
        <button class="btn sm" data-av="0" data-id="${e.id}">Not available</button></div>` : ''}</li>`).join('')}</ul>`
      : '<p class="empty">No enquiries yet. Customers who search for something you repair can message you here.</p>'}
  </section>

  <section class="panel"><h2>Booking requests</h2>
    ${bookings.length ? `<ul class="list">${bookings.map(b => `<li class="item">
      <div class="item-main"><b>${esc(b.customer_name)}</b> · ${esc(b.service_name || 'General repair')}
        <div>${esc(b.device)}: ${esc(b.issue)}</div>
        <div class="muted small">${esc(whenText(b.slot))}</div></div>
      <div class="item-actions">
        ${bookTag(b)}
        <input type="number" class="w-sm" value="${b.amount}" data-amt="${b.id}" aria-label="Amount in rupees">
        ${b.status === 'pending' ? `<button class="btn sm primary" data-st="accepted" data-id="${b.id}">Accept</button><button class="btn sm" data-st="rejected" data-id="${b.id}">Decline</button>` : ''}
        ${b.status === 'accepted' ? `<button class="btn sm primary" data-st="completed" data-id="${b.id}">Mark done</button>` : ''}
      </div></li>`).join('')}</ul>` : '<p class="empty">No booking requests yet.</p>'}
  </section>

  <div class="two">
    <section class="panel"><h2>Repairs and prices</h2>
      ${shop.services.length ? `<ul class="list">${shop.services.map(v => `<li class="item"><div class="item-main">${esc(v.name)}<div class="muted small">${v.est_minutes} min</div></div>
        <div class="item-val">₹${v.price_min}–₹${v.price_max}</div><button class="btn sm" data-delsvc="${v.id}" aria-label="Remove ${esc(v.name)}">Remove</button></li>`).join('')}</ul>`
        : '<p class="empty">Add your first repair so customers can see prices.</p>'}
      <hr>
      <form id="svf">
        <div class="field"><input id="svName" placeholder="Repair name, e.g. Hair dryer repair" aria-label="Repair name"></div>
        <div class="grid-3"><input id="svMin" type="number" placeholder="Min ₹" aria-label="Minimum price"><input id="svMax" type="number" placeholder="Max ₹" aria-label="Maximum price"><input id="svMins" type="number" placeholder="Minutes" aria-label="Minutes"></div>
        <button class="btn" style="margin-top:.6rem">Add repair</button>
      </form>
    </section>

    <section class="panel"><h2>Spare parts stock</h2>
      ${shop.spares.length ? `<ul class="list">${shop.spares.map(p => `<li class="item"><div class="item-main">${esc(p.name)}<div class="muted small">${esc(p.compatible_with)}</div></div>
        <div class="item-actions"><input type="number" class="w-sm" value="${p.price}" data-pp="${p.id}" aria-label="Price of ${esc(p.name)}"><input type="number" class="w-sm" value="${p.stock}" data-ps="${p.id}" aria-label="Stock of ${esc(p.name)}">
        <button class="btn sm" data-delsp="${p.id}" aria-label="Remove ${esc(p.name)}">Remove</button></div></li>`).join('')}</ul>
        <button class="btn sm primary" id="saveSp" style="margin-top:.7rem">Save price and stock</button>`
        : '<p class="empty">Add parts so the chatbot can answer stock questions.</p>'}
      <hr>
      <form id="spf">
        <div class="grid-2"><input id="spName" placeholder="Part, e.g. Heating coil" aria-label="Part name"><input id="spFit" placeholder="Fits, e.g. Hair dryer" aria-label="Fits"></div>
        <div class="grid-2" style="margin-top:.6rem"><input id="spPrice" type="number" placeholder="Price ₹" aria-label="Price"><input id="spStock" type="number" placeholder="Stock" aria-label="Stock"></div>
        <button class="btn" style="margin-top:.6rem">Add part</button>
      </form>
    </section>
  </div>`;

  const $ = (id) => document.getElementById(id), v = (id) => $(id).value;
  const run = (fn) => async (...a) => { try { await fn(...a); ownerDash(app); } catch (e) { toast(e.message, true); } };

  $('avail').onchange = run(e => api(`/shops/${shop.id}/availability`, { method: 'PATCH', body: { is_open: e.target.checked } }));
  $('editShop').onclick = () => shopForm(app, shop);
  app.querySelectorAll('[data-av]').forEach(b => b.onclick = run(() =>
    api(`/enquiries/${b.dataset.id}/reply`, { method: 'POST', body: { available: b.dataset.av === '1', reply: app.querySelector(`[data-note="${b.dataset.id}"]`).value } })));
  app.querySelectorAll('[data-st]').forEach(b => b.onclick = run(() =>
    api(`/bookings/${b.dataset.id}/status`, { method: 'PATCH', body: { status: b.dataset.st, amount: app.querySelector(`[data-amt="${b.dataset.id}"]`).value } })));
  $('svf').onsubmit = (e) => { e.preventDefault(); run(() => api(`/shops/${shop.id}/services`, { method: 'POST',
    body: { name: v('svName'), price_min: v('svMin'), price_max: v('svMax'), est_minutes: v('svMins') } }))(); };
  app.querySelectorAll('[data-delsvc]').forEach(b => b.onclick = run(() => api(`/shops/${shop.id}/services/${b.dataset.delsvc}`, { method: 'DELETE' })));
  $('spf').onsubmit = (e) => { e.preventDefault(); run(() => api(`/shops/${shop.id}/spares`, { method: 'POST',
    body: { name: v('spName'), compatible_with: v('spFit'), price: v('spPrice'), stock: v('spStock') } }))(); };
  app.querySelectorAll('[data-delsp]').forEach(b => b.onclick = run(() => api(`/shops/${shop.id}/spares/${b.dataset.delsp}`, { method: 'DELETE' })));
  const sv = $('saveSp');
  if (sv) sv.onclick = run(async () => {
    for (const el of app.querySelectorAll('[data-pp]')) {
      const id = el.dataset.pp;
      await api(`/shops/${shop.id}/spares/${id}`, { method: 'PATCH', body: { price: +el.value, stock: +app.querySelector(`[data-ps="${id}"]`).value } });
    }
    toast('Stock updated.');
  });
}

function shopForm(app, shop) {
  const s = shop || { grp: 'electronics', types: [], handles: [], open_time: '09:00', close_time: '20:00' };
  app.innerHTML = `<section class="panel form-card form-wide"><h1 style="font-size:1.4rem;margin-bottom:1rem">${shop ? 'Edit shop details' : 'Set up your shop'}</h1>
  <form id="sf2">
    <div class="field"><label for="f_name">Shop name</label><input id="f_name" value="${esc(s.name)}"></div>
    <div class="field"><label for="f_grp">Group</label><select id="f_grp">${META.groups.map(g => `<option value="${g.key}" ${s.grp === g.key ? 'selected' : ''}>${esc(g.label)}</option>`).join('')}</select></div>
    <div class="field"><label>What kinds of repair do you do?</label><div class="checks" id="typeBox"></div></div>
    <div class="field"><label for="f_handles">Exactly what do you repair? Separate with commas</label>
      <textarea id="f_handles" rows="3" placeholder="hair dryer, iron box, geyser, refrigerator, split ac">${esc((s.handles || []).join(', '))}</textarea>
      <span class="muted small">Customers who search for these items will find your shop. Be specific.</span></div>
    <div class="field"><label for="f_desc">Description</label><textarea id="f_desc" rows="2">${esc(s.description)}</textarea></div>
    <div class="field"><label for="f_addr">Address</label><input id="f_addr" value="${esc(s.address)}"></div>
    <div class="grid-2">
      <div class="field"><label for="f_city">City</label><input id="f_city" value="${esc(s.city)}"></div>
      <div class="field"><label for="f_phone">Phone with country code</label><input id="f_phone" type="tel" placeholder="+919800000000" value="${esc(s.phone)}"></div>
      <div class="field"><label for="f_open">Opens</label><input id="f_open" type="time" value="${esc(s.open_time)}"></div>
      <div class="field"><label for="f_close">Closes</label><input id="f_close" type="time" value="${esc(s.close_time)}"></div>
      <div class="field"><label for="f_lat">Latitude</label><input id="f_lat" value="${s.lat ?? ''}"></div>
      <div class="field"><label for="f_lng">Longitude</label><input id="f_lng" value="${s.lng ?? ''}"></div>
    </div>
    <div class="row-wrap"><button class="btn primary">Save shop</button><button class="btn" type="button" id="gps">Use my GPS</button>${shop ? '<button class="btn" type="button" id="cancelEdit">Cancel</button>' : ''}</div>
  </form></section>`;
  const $ = (id) => document.getElementById(id), v = (id) => $(id).value;
  const drawTypes = () => {
    const g = META.groups.find(x => x.key === v('f_grp'));
    $('typeBox').innerHTML = g.types.map(t => `<label class="check"><input type="checkbox" value="${t.key}" ${(s.types || []).includes(t.key) ? 'checked' : ''}>${esc(t.label)}</label>`).join('');
  };
  drawTypes();
  $('f_grp').onchange = () => { s.types = []; drawTypes(); };
  $('gps').onclick = () => navigator.geolocation ? navigator.geolocation.getCurrentPosition(
    p => { $('f_lat').value = p.coords.latitude.toFixed(5); $('f_lng').value = p.coords.longitude.toFixed(5); },
    () => toast('Location is blocked in your browser.', true)) : toast('Location not supported.', true);
  if ($('cancelEdit')) $('cancelEdit').onclick = () => ownerDash(app);
  $('sf2').onsubmit = async (e) => {
    e.preventDefault();
    const body = { name: v('f_name'), grp: v('f_grp'), types: [...app.querySelectorAll('#typeBox input:checked')].map(i => i.value), handles: v('f_handles'),
      description: v('f_desc'), address: v('f_addr'), city: v('f_city'), phone: v('f_phone'), open_time: v('f_open'), close_time: v('f_close'), lat: v('f_lat'), lng: v('f_lng') };
    try { await api(shop ? '/shops/' + shop.id : '/shops', { method: shop ? 'PUT' : 'POST', body }); toast('Shop saved.'); ownerDash(app); }
    catch (err) { toast(err.message, true); }
  };
}
