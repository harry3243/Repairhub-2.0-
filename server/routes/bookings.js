const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

const SEL = `SELECT b.*, s.name AS shop_name, s.phone AS shop_phone, v.name AS service_name, u.name AS customer_name
  FROM bookings b JOIN shops s ON s.id=b.shop_id JOIN users u ON u.id=b.user_id
  LEFT JOIN services v ON v.id=b.service_id`;

router.post('/', auth('customer'), (req, res) => {
  const { shop_id, service_id, device, issue, slot } = req.body || {};
  const shop = db.prepare('SELECT * FROM shops WHERE id=?').get(shop_id);
  if (!shop) return res.status(404).json({ error: 'Shop not found.' });
  if (!device || !issue) return res.status(400).json({ error: 'Tell the shop which device it is and what is wrong.' });
  let amount = 0;
  if (service_id) {
    const sv = db.prepare('SELECT * FROM services WHERE id=? AND shop_id=?').get(service_id, shop_id);
    if (!sv) return res.status(400).json({ error: 'Selected service does not belong to this shop.' });
    amount = sv.price_min; // starting estimate; owner confirms the final amount when accepting
  }
  const i = db.prepare('INSERT INTO bookings (shop_id,user_id,service_id,device,issue,slot,amount) VALUES (?,?,?,?,?,?,?)')
    .run(shop_id, req.user.id, service_id || null, device, issue, slot || '', amount);
  res.json({ id: i.lastInsertRowid });
});

router.get('/mine', auth('customer'), (req, res) =>
  res.json(db.prepare(SEL + ' WHERE b.user_id=? ORDER BY b.id DESC').all(req.user.id)));

router.get('/shop', auth('owner'), (req, res) =>
  res.json(db.prepare(SEL + ' WHERE s.owner_id=? ORDER BY b.id DESC').all(req.user.id)));

router.patch('/:id/status', auth(), (req, res) => {
  const b = db.prepare('SELECT b.*, s.owner_id FROM bookings b JOIN shops s ON s.id=b.shop_id WHERE b.id=?').get(req.params.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  const { status, amount } = req.body || {};
  if (req.user.role === 'owner' && b.owner_id === req.user.id) {
    if (!['accepted', 'rejected', 'completed'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
    db.prepare('UPDATE bookings SET status=?, amount=COALESCE(?,amount) WHERE id=?').run(status, amount ? +amount : null, b.id);
  } else if (req.user.role === 'customer' && b.user_id === req.user.id) {
    if (status !== 'cancelled' || b.payment_status === 'paid') return res.status(400).json({ error: 'This booking cannot be cancelled.' });
    db.prepare("UPDATE bookings SET status='cancelled' WHERE id=?").run(b.id);
  } else return res.status(403).json({ error: 'Not allowed.' });
  res.json({ ok: true });
});

module.exports = router;
