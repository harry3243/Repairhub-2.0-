const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// A customer asks one or many shops: "Do you repair X? Are you available today? Rough price?"
// The shop answers Available / Not available with a note. Replies show up under "My bookings".
const SEL = `SELECT e.*, s.name AS shop_name, s.phone AS shop_phone, u.name AS customer_name
  FROM enquiries e JOIN shops s ON s.id=e.shop_id JOIN users u ON u.id=e.user_id`;

router.post('/', auth('customer'), (req, res) => {
  const { item, message } = req.body || {};
  const ids = [...new Set((req.body.shop_ids || (req.body.shop_id ? [req.body.shop_id] : [])).map(Number))].slice(0, 10);
  if (!ids.length || !item || !item.trim()) return res.status(400).json({ error: 'Tell the shop what needs repair.' });
  const ins = db.prepare('INSERT INTO enquiries (shop_id,user_id,item,message) VALUES (?,?,?,?)');
  const exists = db.prepare('SELECT 1 FROM shops WHERE id=?');
  let sent = 0;
  ids.forEach(id => { if (exists.get(id)) { ins.run(id, req.user.id, item.trim().slice(0, 120), (message || '').slice(0, 500)); sent++; } });
  if (!sent) return res.status(404).json({ error: 'Shop not found.' });
  res.json({ sent });
});

router.get('/mine', auth('customer'), (req, res) =>
  res.json(db.prepare(SEL + ' WHERE e.user_id=? ORDER BY e.id DESC').all(req.user.id)));

router.get('/shop', auth('owner'), (req, res) =>
  res.json(db.prepare(SEL + ' WHERE s.owner_id=? ORDER BY e.status ASC, e.id DESC').all(req.user.id)));

router.post('/:id/reply', auth('owner'), (req, res) => {
  const e = db.prepare('SELECT e.*, s.owner_id FROM enquiries e JOIN shops s ON s.id=e.shop_id WHERE e.id=?').get(req.params.id);
  if (!e) return res.status(404).json({ error: 'Enquiry not found.' });
  if (e.owner_id !== req.user.id) return res.status(403).json({ error: 'Not your enquiry.' });
  db.prepare("UPDATE enquiries SET status='replied', available=?, reply=?, replied_at=CURRENT_TIMESTAMP WHERE id=?")
    .run(req.body.available ? 1 : 0, (req.body.reply || '').slice(0, 300), e.id);
  res.json({ ok: true });
});

module.exports = router;
