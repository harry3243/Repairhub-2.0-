const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, SECRET, { expiresIn: '7d' });

// auth()            -> any logged in user
// auth('owner')     -> only owners
function auth(...roles) {
  return (req, res, next) => {
    const h = req.headers.authorization || '';
    const token = h.startsWith('Bearer ') ? h.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Please log in first.' });
    try {
      req.user = jwt.verify(token, SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    if (roles.length && !roles.includes(req.user.role))
      return res.status(403).json({ error: 'You do not have access to this action.' });
    next();
  };
}
module.exports = { auth, sign };
