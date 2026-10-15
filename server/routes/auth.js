const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { sign, auth } = require('../middleware/auth');

router.post('/register', (req, res) => {
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password || password.length < 6)
    return res.status(400).json({ error: 'Name, email and a password of 6+ characters are required.' });
  const r = role === 'owner' ? 'owner' : 'customer';
  try {
    const info = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)')
      .run(name.trim(), email.trim().toLowerCase(), bcrypt.hashSync(password, 10), r);
    const user = { id: info.lastInsertRowid, name, role: r };
    res.json({ token: sign(user), user });
  } catch {
    res.status(409).json({ error: 'This email is already registered.' });
  }
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get((email || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  const user = { id: u.id, name: u.name, role: u.role };
  res.json({ token: sign(user), user });
});

router.get('/me', auth(), (req, res) => res.json({ user: req.user }));

module.exports = router;
