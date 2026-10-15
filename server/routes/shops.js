const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');
const S = require('../lib/search');
const { loadShops, getShop } = require('../lib/shops');

router.use(auth()); // the app is login-first, so every shop endpoint needs a logged-in user

const brief = (s) => { const { services, spares, ...rest } = s; return rest; };

// GET /api/shops?q=&group=&type=&open=1&lat=&lng=&maxKm=
// With q: only shops that repair that item come back as "exact"; same-category shops come back as "related".
router.get('/', (req, res) => {
  const { group, type, q, lat, lng, open, maxKm } = req.query;
  let shops = loadShops();
  if (group) shops = shops.filter(s => s.grp === group);
  if (type) shops = shops.filter(s => s.types.includes(type));

  let item = null;
  if (q && q.trim()) {
    const det = S.detect(q);
    item = det[0] ? det[0].it.name : null;
    shops = shops.map(s => ({ s, m: S.matchShop(s, q, det) })).filter(x => x.m.match)
      .map(x => ({ ...x.s, match: x.m.match, matched_item: x.m.item || null, score: x.m.score || 0 }));
  } else shops = shops.map(s => ({ ...s, match: 'exact', score: 0 }));

  if (open === '1') shops = shops.filter(s => s.open_now);
  if (lat && lng) {
    shops.forEach(s => { s.distance_km = s.lat != null ? S.distanceKm(+lat, +lng, s.lat, s.lng) : null; });
    if (maxKm) shops = shops.filter(s => s.distance_km != null && s.distance_km <= +maxKm);
  }
  shops.sort((a, b) => (a.match === b.match ? 0 : a.match === 'exact' ? -1 : 1) || (b.score - a.score) || (b.open_now - a.open_now) ||
    (lat && lng ? (a.distance_km ?? 9e9) - (b.distance_km ?? 9e9) : (b.rating || 0) - (a.rating || 0)));
  res.json({ q: q || '', item, shops: shops.map(brief) });
});

router.get('/mine/info', auth('owner'), (req, res) => {
  const s = loadShops().find(x => x.owner_id === req.user.id);
  res.json(s || null);
});

router.get('/:id', (req, res) => {
  const s = getShop(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shop not found.' });
  s.reviews = db.prepare(`SELECT r.*, u.name AS user_name FROM reviews r JOIN users u ON u.id=r.user_id
    WHERE shop_id=? ORDER BY r.created_at DESC`).all(s.id);
  res.json(s);
});

// ---- owner: create / edit shop
function cleanShop(b) {
  const g = S.GROUPS.find(x => x.key === b.grp);
  if (!b.name || !g) return { error: 'Shop name and a group (Electronics or Automobiles) are required.' };
  const valid = g.types.map(t => t.key);
  const types = (Array.isArray(b.types) ? b.types : []).filter(t => valid.includes(t));
  if (!types.length) return { error: 'Choose at least one type of repair.' };
  const raw = Array.isArray(b.handles) ? b.handles : String(b.handles || '').split(/[,\n]/);
  const handles = [...new Set(raw.map(x => String(x).trim()).filter(Boolean))].slice(0, 80);
  const num = (v) => (v === '' || v == null || isNaN(+v) ? null : +v);
  return { v: [b.name.trim(), g.key, types.join(','), handles.join(', '), b.description || '', b.address || '', b.city || '',
    num(b.lat), num(b.lng), (b.phone || '').trim(), b.open_time || '09:00', b.close_time || '20:00'] };
}

router.post('/', auth('owner'), (req, res) => {
  const c = cleanShop(req.body || {});
  if (c.error) return res.status(400).json({ error: c.error });
  if (db.prepare('SELECT 1 FROM shops WHERE owner_id=?').get(req.user.id))
    return res.status(409).json({ error: 'You already have a shop. Edit it instead.' });
  const i = db.prepare(`INSERT INTO shops (owner_id,name,grp,types,handles,description,address,city,lat,lng,phone,open_time,close_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, ...c.v);
  res.json({ id: i.lastInsertRowid });
});

function ownShop(req, res, next) {
  const s = db.prepare('SELECT * FROM shops WHERE id=?').get(req.params.id);
  if (!s) return res.status(404).json({ error: 'Shop not found.' });
  if (s.owner_id !== req.user.id) return res.status(403).json({ error: 'This is not your shop.' });
  req.shop = s; next();
}

router.put('/:id', auth('owner'), ownShop, (req, res) => {
  const c = cleanShop(req.body || {});
  if (c.error) return res.status(400).json({ error: c.error });
  db.prepare(`UPDATE shops SET name=?,grp=?,types=?,handles=?,description=?,address=?,city=?,lat=?,lng=?,phone=?,open_time=?,close_time=? WHERE id=?`)
    .run(...c.v, req.shop.id);
  res.json({ ok: true });
});

router.patch('/:id/availability', auth('owner'), ownShop, (req, res) => {
  db.prepare('UPDATE shops SET is_open=? WHERE id=?').run(req.body.is_open ? 1 : 0, req.shop.id);
  res.json({ ok: true });
});

// ---- services
router.post('/:id/services', auth('owner'), ownShop, (req, res) => {
  const { name, price_min, price_max, est_minutes } = req.body || {};
  if (!name || price_min == null || price_max == null) return res.status(400).json({ error: 'Service name and price range are required.' });
  const i = db.prepare('INSERT INTO services (shop_id,name,price_min,price_max,est_minutes) VALUES (?,?,?,?,?)')
    .run(req.shop.id, name, +price_min, +price_max, +est_minutes || 60);
  res.json({ id: i.lastInsertRowid });
});
router.delete('/:id/services/:sid', auth('owner'), ownShop, (req, res) => {
  db.prepare('DELETE FROM services WHERE id=? AND shop_id=?').run(req.params.sid, req.shop.id);
  res.json({ ok: true });
});

// ---- spares
router.post('/:id/spares', auth('owner'), ownShop, (req, res) => {
  const { name, compatible_with, price, stock } = req.body || {};
  if (!name || price == null) return res.status(400).json({ error: 'Spare part name and price are required.' });
  const i = db.prepare('INSERT INTO spares (shop_id,name,compatible_with,price,stock) VALUES (?,?,?,?,?)')
    .run(req.shop.id, name, compatible_with || '', +price, +stock || 0);
  res.json({ id: i.lastInsertRowid });
});
router.patch('/:id/spares/:pid', auth('owner'), ownShop, (req, res) => {
  const { price, stock } = req.body || {};
  db.prepare('UPDATE spares SET price=COALESCE(?,price), stock=COALESCE(?,stock) WHERE id=? AND shop_id=?')
    .run(price ?? null, stock ?? null, req.params.pid, req.shop.id);
  res.json({ ok: true });
});
router.delete('/:id/spares/:pid', auth('owner'), ownShop, (req, res) => {
  db.prepare('DELETE FROM spares WHERE id=? AND shop_id=?').run(req.params.pid, req.shop.id);
  res.json({ ok: true });
});

// ---- reviews (one per customer per shop; posting again updates it)
router.post('/:id/reviews', auth('customer'), (req, res) => {
  const rating = +req.body.rating;
  if (!(rating >= 1 && rating <= 5)) return res.status(400).json({ error: 'Choose a rating from 1 to 5.' });
  if (!db.prepare('SELECT 1 FROM shops WHERE id=?').get(req.params.id)) return res.status(404).json({ error: 'Shop not found.' });
  db.prepare(`INSERT INTO reviews (shop_id,user_id,rating,comment) VALUES (?,?,?,?)
    ON CONFLICT(shop_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment, created_at=CURRENT_TIMESTAMP`)
    .run(req.params.id, req.user.id, rating, (req.body.comment || '').slice(0, 500));
  res.json({ ok: true });
});

module.exports = router;
