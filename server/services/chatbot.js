const S = require('../lib/search');
const { loadShops } = require('./../lib/shops');

// Optional: with ANTHROPIC_API_KEY set, Claude rewrites the answer in natural language (typos, other languages).
// It is only given our own shop data, so it cannot invent shops, prices or stock.
async function askClaude(shop, base, others, message) {
  const ctx = JSON.stringify({
    this_shop: { name: shop.name, open_now: shop.open_now, hours: `${shop.open_time}-${shop.close_time}`, phone: shop.phone,
      repairs: shop.handles, services: shop.services.map(s => ({ name: s.name, from: s.price_min, to: s.price_max, minutes: s.est_minutes })),
      spares: shop.spares.map(p => ({ name: p.name, fits: p.compatible_with, price: p.price, stock: p.stock })) },
    other_shops_that_repair_it: others, draft_answer: base.reply });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6', max_tokens: 400,
      system: 'You are the assistant inside a repair-shop finder. Answer only from the JSON data. State clearly whether this shop repairs the item, price range, stock, and whether it is open. If this shop does not repair it and other shops do, name them. Suggest the "Check availability" button or a call before travelling. Never invent shops, prices or stock. Under 80 words, in the customer\'s language.',
      messages: [{ role: 'user', content: `Data: ${ctx}\n\nCustomer: ${message}` }],
    }),
  });
  if (!r.ok) throw new Error('Claude API ' + r.status);
  const d = await r.json();
  return d.content.filter(c => c.type === 'text').map(c => c.text).join('\n');
}

async function answer(shopId, message) {
  const all = loadShops(), shop = all.find(s => s.id === +shopId);
  if (!shop) return { reply: 'Shop not found.', suggestions: [] };
  const base = S.chatReply(shop, all, message);
  if (process.env.ANTHROPIC_API_KEY) {
    try { return { reply: await askClaude(shop, base, base.suggestions, message), suggestions: base.suggestions }; }
    catch (e) { console.warn('Chatbot fallback:', e.message); }
  }
  return base;
}
module.exports = { answer };
