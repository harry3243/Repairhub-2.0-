const db = require('../db');
const S = require('./search');

const split = (v) => String(v || '').split(',').map(x => x.trim()).filter(Boolean);

// All shops with services, spares, rating and open status attached (what search and the chatbot work on).
function loadShops() {
  const rows = db.prepare(`SELECT s.*,
    (SELECT ROUND(AVG(rating),1) FROM reviews WHERE shop_id=s.id) AS rating,
    (SELECT COUNT(*) FROM reviews WHERE shop_id=s.id) AS review_count FROM shops s`).all();
  const svc = {}, sp = {};
  db.prepare('SELECT * FROM services ORDER BY price_min').all().forEach(v => (svc[v.shop_id] = svc[v.shop_id] || []).push(v));
  db.prepare('SELECT * FROM spares ORDER BY name').all().forEach(v => (sp[v.shop_id] = sp[v.shop_id] || []).push(v));
  return rows.map(s => {
    const services = svc[s.id] || [];
    return { ...s, types: split(s.types), handles: split(s.handles), services, spares: sp[s.id] || [],
      from_price: services.length ? Math.min(...services.map(v => v.price_min)) : null, open_now: S.openNow(s) };
  });
}
const getShop = (id) => loadShops().find(s => s.id === +id);

module.exports = { loadShops, getShop, split };
