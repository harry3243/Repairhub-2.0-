const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

const PROVIDER = process.env.PAYMENT_PROVIDER || 'mock';

/*
 * PAYMENT FLOW
 * 1. POST /api/payments/checkout  -> creates a payment record and returns what the frontend needs
 * 2. Customer pays (mock: click "Pay now"; razorpay: Razorpay Checkout popup)
 * 3. POST /api/payments/confirm   -> verifies and marks the booking paid
 *
 * To go live with Razorpay (UPI, cards, netbanking):
 *   npm i razorpay
 *   in /checkout: const order = await rzp.orders.create({ amount: amount*100, currency:'INR', receipt:'bk_'+id })
 *                 store order.id in provider_ref, return { key: RAZORPAY_KEY_ID, order_id: order.id }
 *   in /confirm : verify signature = HMAC_SHA256(order_id + '|' + payment_id, RAZORPAY_KEY_SECRET)
 *                 only then mark paid. Never trust the browser alone.
 */

router.post('/checkout', auth('customer'), (req, res) => {
  const b = db.prepare('SELECT * FROM bookings WHERE id=? AND user_id=?').get(req.body.booking_id, req.user.id);
  if (!b) return res.status(404).json({ error: 'Booking not found.' });
  if (b.payment_status === 'paid') return res.status(400).json({ error: 'Already paid.' });
  if (!['accepted', 'completed'].includes(b.status))
    return res.status(400).json({ error: 'You can pay once the shop accepts your booking.' });
  const i = db.prepare('INSERT INTO payments (booking_id,amount,provider) VALUES (?,?,?)').run(b.id, b.amount, PROVIDER);
  res.json({ payment_id: i.lastInsertRowid, amount: b.amount, provider: PROVIDER });
});

router.post('/confirm', auth('customer'), (req, res) => {
  const p = db.prepare(`SELECT p.* FROM payments p JOIN bookings b ON b.id=p.booking_id
    WHERE p.id=? AND b.user_id=?`).get(req.body.payment_id, req.user.id);
  if (!p) return res.status(404).json({ error: 'Payment not found.' });
  if (PROVIDER !== 'mock') return res.status(501).json({ error: 'Add Razorpay signature verification here.' });
  db.prepare("UPDATE payments SET status='paid', provider_ref=? WHERE id=?").run('MOCK-' + Date.now(), p.id);
  db.prepare("UPDATE bookings SET payment_status='paid' WHERE id=?").run(p.booking_id);
  res.json({ ok: true });
});

module.exports = router;
