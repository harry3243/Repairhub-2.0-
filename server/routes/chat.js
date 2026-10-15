const router = require('express').Router();
const { auth } = require('../middleware/auth');
const { answer } = require('../services/chatbot');

router.post('/', auth(), async (req, res) => {
  const { shop_id, message } = req.body || {};
  if (!shop_id || !message || !message.trim()) return res.status(400).json({ error: 'Ask a question about this shop.' });
  res.json(await answer(shop_id, message.slice(0, 300)));
});
module.exports = router;
