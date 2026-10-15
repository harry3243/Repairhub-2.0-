/*
 * Shared search + chatbot logic. Runs in Node (server) and in the browser (preview).
 *  - GROUPS: Electronics / Automobiles and their repair types
 *  - ITEMS : devices and vehicles people search for, with aliases ("fridge" = refrigerator)
 *  - detect(): finds which item a sentence is about, tolerating typos ("hair drier")
 *  - matchShop(): does this shop actually repair that item? exact / related / none
 *  - chatReply(): answers a customer question from real shop data
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.RHSearch = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  const GROUPS = [
    { key: 'electronics', label: 'Electronics', types: [
      { key: 'phone', label: 'Phones & tablets' },
      { key: 'computer', label: 'Laptops & computers' },
      { key: 'tv', label: 'TV & audio' },
      { key: 'wm', label: 'Washing machines' },
      { key: 'fridge', label: 'Refrigerators' },
      { key: 'ac', label: 'AC & coolers' },
      { key: 'small', label: 'Kitchen & small appliances' },
    ] },
    { key: 'automobile', label: 'Automobiles', types: [
      { key: 'bike', label: 'Bikes & scooters' },
      { key: 'car', label: 'Cars' },
      { key: 'other', label: 'Auto-rickshaw & others' },
    ] },
  ];

  const I = (name, type, aliases) => ({ name, type, aliases: aliases || [] });
  const ITEMS = [
    I('mobile phone', 'phone', ['phone', 'mobile', 'smartphone', 'cell phone', 'iphone', 'android', 'redmi', 'oneplus']),
    I('tablet', 'phone', ['ipad', 'tab']),
    I('smartwatch', 'phone', ['smart watch', 'apple watch']),
    I('laptop', 'computer', ['notebook', 'macbook']),
    I('desktop computer', 'computer', ['desktop', 'pc', 'computer', 'cpu']),
    I('printer', 'computer', ['inkjet printer', 'laser printer']),
    I('monitor', 'computer', ['computer monitor']),
    I('tv', 'tv', ['television', 'led tv', 'lcd tv', 'smart tv', 'oled']),
    I('speaker', 'tv', ['soundbar', 'home theatre', 'bluetooth speaker', 'music system', 'audio system']),
    I('set top box', 'tv', ['dth']),
    I('washing machine', 'wm', ['washer', 'front load', 'top load']),
    I('refrigerator', 'fridge', ['fridge', 'freezer', 'refrigerater', 'deep freezer']),
    I('ac', 'ac', ['air conditioner', 'air conditioning', 'split ac', 'window ac']),
    I('air cooler', 'ac', ['cooler', 'desert cooler']),
    I('hair dryer', 'small', ['hair drier', 'hairdryer', 'hair blower', 'blow dryer']),
    I('iron box', 'small', ['iron', 'steam iron', 'electric iron', 'clothes iron']),
    I('mixer grinder', 'small', ['mixer', 'grinder', 'blender', 'juicer']),
    I('microwave', 'small', ['microwave oven', 'oven', 'otg']),
    I('geyser', 'small', ['water heater', 'heater']),
    I('fan', 'small', ['ceiling fan', 'table fan', 'exhaust fan', 'pedestal fan']),
    I('induction stove', 'small', ['induction', 'induction cooktop', 'cooktop']),
    I('electric kettle', 'small', ['kettle']),
    I('vacuum cleaner', 'small', ['vacuum']),
    I('water purifier', 'small', ['ro', 'aquaguard', 'ro purifier']),
    I('inverter', 'small', ['ups', 'battery inverter']),
    I('trimmer', 'small', ['shaver', 'hair trimmer', 'epilator']),
    I('rice cooker', 'small', ['electric cooker']),
    I('bike', 'bike', ['motorcycle', 'scooter', 'two wheeler', 'scooty', 'activa', 'royal enfield', 'pulsar', 'splendor', 'bullet', 'motorbike']),
    I('electric scooter', 'bike', ['ev scooter', 'e scooter']),
    I('bicycle', 'bike', ['cycle']),
    I('car', 'car', ['hatchback', 'sedan', 'suv', 'four wheeler', 'swift', 'i20', 'creta']),
    I('auto rickshaw', 'other', ['rickshaw', 'three wheeler', 'tuk tuk']),
    I('truck', 'other', ['lorry', 'tempo', 'mini truck']),
  ];

  const STOP = new Set(('repair repairs repairing fix fixing service servicing shop shops near nearby me my for do you does can how much ' +
    'cost price charges charge is are available the a an and or of to in on it i please want need looking find any who where that this ' +
    'with what will hey hi hello your yours get have has open today now be at also there').split(' '));

  // ---------- text helpers ----------
  const STEM = (w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) ? w.slice(0, -1) : w;
  const words = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(Boolean).map(STEM);
  const content = (s) => words(s).filter(w => !STOP.has(w));

  function lev(a, b) {
    const m = a.length, n = b.length; if (!m) return n; if (!n) return m;
    let prev = Array.from({ length: n + 1 }, (_, j) => j);
    for (let i = 1; i <= m; i++) {
      const cur = [i];
      for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
    return prev[n];
  }
  const tol = (len) => (len <= 4 ? 0 : len <= 7 ? 1 : 2);
  const near = (a, b) => a === b || (!/^\d+$/.test(a) && !/^\d+$/.test(b) && lev(a, b) <= tol(Math.min(a.length, b.length)));

  // ---------- which item is the text about? ----------
  function detect(q) {
    const toks = content(q), found = new Map();
    for (const it of ITEMS) {
      for (const ph of [it.name, ...it.aliases]) {
        const pw = words(ph);
        for (let i = 0; i + pw.length <= toks.length; i++) {
          if (pw.every((w, k) => near(w, toks[i + k]))) {
            const score = pw.length * 10 + pw.join('').length;
            const cur = found.get(it.name);
            if (!cur || cur.score < score) found.set(it.name, { it, score, span: [i, i + pw.length] });
          }
        }
      }
    }
    return [...found.values()].sort((a, b) => b.score - a.score);
  }

  function shopItemSet(shop) {
    const set = new Set();
    const add = (t) => detect(t).forEach(d => set.add(d.it.name));
    (shop.handles || []).forEach(add);
    (shop.services || []).forEach(s => add(s.name));
    (shop.spares || []).forEach(p => add(p.name + ' ' + (p.compatible_with || '')));
    return set;
  }
  function shopWords(shop) {
    return words([shop.name, shop.address, shop.city, (shop.handles || []).join(' '),
      (shop.services || []).map(s => s.name).join(' '),
      (shop.spares || []).map(p => p.name + ' ' + (p.compatible_with || '')).join(' ')].join(' '));
  }
  const hasTok = (sw, t) => sw.some(w => near(t, w));

  // match: 'exact' (shop lists it), 'related' (same category, may handle it), or null
  function matchShop(shop, q, det) {
    det = det || detect(q);
    const toks = content(q);
    if (!toks.length) return { match: 'exact', score: 0 };
    const sw = shopWords(shop);
    if (det.length) {
      const d = det[0], inSpan = (i) => i >= d.span[0] && i < d.span[1];
      const extra = toks.filter((t, i) => !inSpan(i) && hasTok(sw, t)).length;
      const items = shopItemSet(shop);
      const hit = det.find(x => items.has(x.it.name));
      if (hit) return { match: 'exact', item: hit.it.name, score: 100 + extra };
      const rel = det.find(x => (shop.types || []).includes(x.it.type));
      if (rel) return { match: 'related', item: rel.it.name, score: extra };
      return { match: null };
    }
    const n = toks.filter(t => hasTok(sw, t)).length;
    if (n === toks.length) return { match: 'exact', score: 100 + n };
    if (n > 0) return { match: 'related', score: n };
    return { match: null };
  }

  // ---------- misc ----------
  function openNow(s) {
    if (!s.is_open) return false;
    const n = new Date(), cur = n.getHours() * 60 + n.getMinutes();
    const [oh, om] = (s.open_time || '00:00').split(':').map(Number), [ch, cm] = (s.close_time || '23:59').split(':').map(Number);
    return cur >= oh * 60 + om && cur <= ch * 60 + cm;
  }
  function distanceKm(lat1, lng1, lat2, lng2) {
    const r = (d) => d * Math.PI / 180, dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
    return +(12742 * Math.asin(Math.sqrt(a))).toFixed(1);
  }
  const typeLabel = (k) => { for (const g of GROUPS) { const t = g.types.find(x => x.key === k); if (t) return t.label; } return k; };

  // ---------- chatbot (works with no API key) ----------
  function bestBy(list, toks, textOf, limit) {
    const sc = list.map(x => { const w = words(textOf(x)); return { x, s: toks.filter(t => hasTok(w, t)).length }; }).filter(o => o.s > 0);
    if (!sc.length) return [];
    const max = Math.max(...sc.map(o => o.s));
    return sc.filter(o => o.s === max).slice(0, limit || 2).map(o => o.x);
  }
  const pick = (s) => ({ id: s.id, name: s.name, open_now: !!s.open_now, phone: s.phone });
  const byOpenThenRating = (a, b) => (b.open_now - a.open_now) || ((b.rating || 0) - (a.rating || 0));

  function chatReply(shop, all, message) {
    const det = detect(message), item = det[0] && det[0].it, toks = content(message);
    const openLine = shop.open_now ? `They are open now (${shop.open_time}–${shop.close_time}).` : `They are closed right now. Hours: ${shop.open_time}–${shop.close_time}.`;
    const askLine = 'Use "Check availability" on this page to message the shop, or call them, before you travel.';
    const lines = []; let suggestions = [];

    const svcLines = () => bestBy(shop.services || [], toks, s => s.name).map(s => `${s.name}: ₹${s.price_min}–₹${s.price_max}, about ${s.est_minutes} min.`);
    const spareLines = () => bestBy(shop.spares || [], toks, p => p.name + ' ' + (p.compatible_with || '')).map(p => p.stock > 0
      ? `Spare in stock: ${p.name} (${p.compatible_with || 'various'}) at ₹${p.price}, ${p.stock} left.`
      : `The ${p.name} (${p.compatible_with || 'this model'}) is out of stock right now.`);

    if (item) {
      if (shopItemSet(shop).has(item.name)) {
        lines.push(`Yes, ${shop.name} repairs ${item.name}.`);
        const sv = svcLines();
        lines.push(...(sv.length ? sv : ['The price depends on the fault, so ask for a quote.']), ...spareLines(), openLine, askLine);
      } else {
        const others = all.filter(s => s.id !== shop.id && shopItemSet(s).has(item.name)).sort(byOpenThenRating);
        if (others.length) {
          lines.push(`${shop.name} does not list ${item.name} repair, but ${others.length} other shop${others.length > 1 ? 's do' : ' does'}: ` +
            others.slice(0, 3).map(o => `${o.name} (${o.open_now ? 'open now' : 'closed now'})`).join(', ') + '.');
          suggestions = others.slice(0, 3).map(pick);
        } else {
          const rel = all.filter(s => s.id !== shop.id && (s.types || []).includes(item.type)).sort(byOpenThenRating);
          lines.push(`No shop lists ${item.name} repair yet.`);
          if (rel.length) {
            lines.push(`These ${typeLabel(item.type).toLowerCase()} shops might handle it. Send them an enquiry: ` + rel.slice(0, 3).map(o => o.name).join(', ') + '.');
            suggestions = rel.slice(0, 3).map(pick);
          } else lines.push('Try another keyword, or check back soon as new shops join.');
        }
      }
    } else {
      const sv = svcLines(), sp = spareLines();
      if (sv.length || sp.length) lines.push(...sv, ...sp, 'The final price is confirmed after inspection.');
      else {
        lines.push(`I could not tell which device you mean. ${shop.name} repairs: ${(shop.handles || []).join(', ') || 'see the list on this page'}.`);
        lines.push('To find shops for any other item, use the search on the home page.');
      }
      if (/open|avail|today|now|hour|time|slot/i.test(message)) lines.push(openLine, askLine);
    }
    return { reply: lines.join(' '), suggestions };
  }

  return { GROUPS, ITEMS, detect, matchShop, shopItemSet, chatReply, words, typeLabel, openNow, distanceKm };
});
