const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const SCHEMA_VERSION = 2; // bump when the tables change (dev databases are rebuilt automatically)
const dbFile = path.join(__dirname, '..', 'data', 'repairhub.db');
fs.mkdirSync(path.dirname(dbFile), { recursive: true });
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

if (db.pragma('user_version', { simple: true }) < SCHEMA_VERSION) {
  db.pragma('foreign_keys = OFF');
  ['payments', 'bookings', 'enquiries', 'reviews', 'spares', 'services', 'shops', 'users'].forEach(t => db.exec(`DROP TABLE IF EXISTS ${t}`));
  db.pragma('user_version = ' + SCHEMA_VERSION);
}
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('customer','owner')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS shops (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  grp TEXT NOT NULL CHECK (grp IN ('electronics','automobile')),
  types TEXT NOT NULL DEFAULT '',      -- comma list of type keys, e.g. "small,fridge"
  handles TEXT NOT NULL DEFAULT '',    -- what the shop repairs, e.g. "hair dryer, iron box, refrigerator"
  description TEXT,
  address TEXT,
  city TEXT,
  lat REAL, lng REAL,
  phone TEXT,                          -- include country code, e.g. +919800000001
  is_open INTEGER DEFAULT 1,
  open_time TEXT DEFAULT '09:00',
  close_time TEXT DEFAULT '20:00',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_min INTEGER NOT NULL,
  price_max INTEGER NOT NULL,
  est_minutes INTEGER DEFAULT 60
);
CREATE TABLE IF NOT EXISTS spares (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  compatible_with TEXT,
  price INTEGER NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (shop_id, user_id)
);
CREATE TABLE IF NOT EXISTS enquiries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','replied')),
  available INTEGER,                   -- 1 yes, 0 no, NULL not answered
  reply TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  replied_at TEXT
);
CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id INTEGER NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER REFERENCES services(id) ON DELETE SET NULL,
  device TEXT,
  issue TEXT,
  slot TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected','completed','cancelled')),
  amount INTEGER DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_id INTEGER NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_ref TEXT,
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN ('created','paid','failed')),
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`);

// name, grp, types, handles, description, address, lat, lng, phone, is_open, open, close, services, spares
const DEMO = [
  ['Whitefield Mobile Care', 'electronics', 'phone', 'mobile phone, smartphone, tablet, iphone, android',
    'Screen, battery and charging-port repairs for all major phone brands.', '12 ITPL Main Rd, Whitefield', 12.9698, 77.7500, '+919800000001', 1, '00:00', '23:59',
    [['Screen replacement', 1500, 6000, 45], ['Battery replacement', 600, 1800, 30], ['Charging port repair', 400, 900, 40]],
    [['Display', 'iPhone 11', 4200, 3], ['Display', 'Samsung A52', 2800, 0], ['Battery', 'Redmi Note 10', 650, 8]]],
  ['Koramangala Phone Clinic', 'electronics', 'phone', 'mobile phone, tablet, smartwatch',
    'Same-day repairs, water damage and motherboard work.', '80 Feet Rd, Koramangala', 12.9352, 77.6245, '+919800000002', 1, '10:00', '20:00',
    [['Screen replacement', 1800, 7500, 60], ['Water damage cleaning', 800, 2500, 120]],
    [['Display', 'OnePlus 9', 5200, 2], ['Battery', 'iPhone 12', 1800, 4]]],
  ['HSR Electronics Repair Hub', 'electronics', 'computer,tv,wm,small', 'laptop, desktop computer, tv, washing machine, mixer grinder, microwave',
    'TV, laptop, washing machine, mixer and microwave repairs.', '27th Main, HSR Layout', 12.9116, 77.6474, '+919800000005', 1, '10:00', '19:30',
    [['Laptop screen replacement', 2500, 7000, 120], ['TV panel diagnosis', 300, 800, 45], ['Washing machine repair', 500, 2500, 90]],
    [['Laptop SSD 512GB', 'Any laptop', 3200, 5], ['Laptop display', 'Dell Inspiron 15', 4500, 1]]],
  ['Jayanagar Home Appliance Care', 'electronics', 'small,fridge,ac,wm', 'hair dryer, iron box, geyser, mixer grinder, induction stove, refrigerator, split ac, window ac, washing machine',
    'Everyday home appliances, from hair dryers and irons to fridges and ACs.', '4th Block, Jayanagar', 12.9250, 77.5938, '+919800000006', 1, '00:00', '23:59',
    [['Hair dryer repair', 150, 500, 30], ['Iron box repair', 100, 300, 20], ['Geyser repair', 300, 1200, 45], ['AC service', 500, 1500, 60], ['Refrigerator gas refill', 1200, 2800, 90]],
    [['Heating coil', 'Hair dryer (universal)', 120, 15], ['Thermostat', 'Iron box', 90, 0], ['Compressor', 'Refrigerator 190L', 3800, 2]]],
  ['Shivajinagar Cool Care', 'electronics', 'ac,fridge', 'split ac, window ac, refrigerator, deep freezer, air cooler',
    'AC and refrigeration specialists. Installation, gas refill and repairs.', 'Commercial St, Shivajinagar', 12.9857, 77.6050, '+919800000007', 1, '09:00', '19:00',
    [['AC gas refill', 1200, 2500, 90], ['AC installation', 800, 1500, 120], ['Fridge repair', 500, 3000, 90]],
    [['Capacitor', 'Split AC', 350, 10], ['Thermostat', 'Refrigerator', 450, 0]]],
  ['Indiranagar Bike Works', 'automobile', 'bike', 'bike, scooter, motorcycle, activa, royal enfield, pulsar',
    'Two-wheeler servicing, puncture, chain and brake work.', '100 Feet Rd, Indiranagar', 12.9784, 77.6408, '+919800000003', 1, '08:00', '19:00',
    [['General service', 500, 1200, 90], ['Brake pad replacement', 250, 600, 30], ['Puncture repair', 80, 200, 15]],
    [['Brake pads', 'Honda Activa', 280, 10], ['Chain set', 'Royal Enfield Classic 350', 1400, 2], ['Air filter', 'Bajaj Pulsar 150', 220, 0]]],
  ['Marathahalli Auto Garage', 'automobile', 'car', 'car, hatchback, sedan, suv',
    'Car servicing, AC repair, denting and painting.', 'Outer Ring Rd, Marathahalli', 12.9569, 77.7011, '+919800000004', 0, '09:00', '18:00',
    [['Full car service', 2500, 6000, 240], ['AC gas refill', 1200, 2500, 90], ['Brake overhaul', 1500, 4000, 120]],
    [['Oil filter', 'Maruti Swift', 250, 12], ['Brake pads', 'Hyundai i20', 1800, 3]]],
];

function seed() {
  const hash = bcrypt.hashSync('password123', 10);
  const addUser = db.prepare('INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,?)');
  const addShop = db.prepare(`INSERT INTO shops (owner_id,name,grp,types,handles,description,address,city,lat,lng,phone,is_open,open_time,close_time)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const addSvc = db.prepare('INSERT INTO services (shop_id,name,price_min,price_max,est_minutes) VALUES (?,?,?,?,?)');
  const addSpare = db.prepare('INSERT INTO spares (shop_id,name,compatible_with,price,stock) VALUES (?,?,?,?,?)');
  const cust = addUser.run('Demo Customer', 'customer@demo.com', hash, 'customer').lastInsertRowid;

  DEMO.forEach((s, i) => {
    const o = addUser.run(`Owner ${i + 1}`, `owner${i + 1}@demo.com`, hash, 'owner');
    const sh = addShop.run(o.lastInsertRowid, s[0], s[1], s[2], s[3], s[4], s[5], 'Bengaluru', s[6], s[7], s[8], s[9], s[10], s[11]);
    s[12].forEach(v => addSvc.run(sh.lastInsertRowid, ...v));
    s[13].forEach(v => addSpare.run(sh.lastInsertRowid, ...v));
  });
  const rv = db.prepare('INSERT INTO reviews (shop_id,user_id,rating,comment) VALUES (?,?,?,?)');
  rv.run(1, cust, 5, 'Fixed my screen in under an hour. Price matched what was shown.');
  rv.run(4, cust, 4, 'Repaired my hair dryer the same day.');
}

if (process.argv.includes('--reseed')) {
  db.pragma('foreign_keys = OFF');
  ['payments', 'bookings', 'enquiries', 'reviews', 'spares', 'services', 'shops', 'users'].forEach(t => db.exec(`DELETE FROM ${t}`));
  db.pragma('foreign_keys = ON');
  seed(); console.log('Database reseeded.');
} else if (db.prepare('SELECT COUNT(*) c FROM shops').get().c === 0) {
  seed(); console.log('Seeded demo data.');
}

module.exports = db;
