# RepairHub

Find repair shops (mobile, bike, auto/car, electronics) with live availability, price ranges,
spare-part stock, reviews, an "is this repair possible?" chatbot, booking and payment.

## Run it
```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm start
```
Open http://localhost:3000. Demo data is created on first run.

Demo logins (password `password123`): `customer@demo.com`, `owner1@demo.com` ... `owner5@demo.com`.
Reset demo data: `npm run seed`.

## Structure
```
repairhub/
├── server/
│   ├── index.js              Express app, mounts routes, serves /public
│   ├── db.js                 SQLite schema (auto-rebuilds when SCHEMA_VERSION changes) + demo seed
│   ├── lib/
│   │   ├── search.js         categories, item aliases, typo-tolerant search, chatbot answers (no API key needed)
│   │   └── shops.js          loads shops with services, spares, rating, open-now
│   ├── middleware/auth.js    JWT login, role check (customer / owner)
│   ├── routes/
│   │   ├── auth.js           register, login
│   │   ├── shops.js          search, detail, owner edits, services, spares, reviews, availability
│   │   ├── enquiries.js      "are you available?" messages to one or many shops, owner replies
│   │   ├── bookings.js       create, list, accept/decline/complete/cancel
│   │   ├── payments.js       checkout + confirm (mock now, Razorpay notes inside)
│   │   └── chat.js           chatbot endpoint
│   └── services/chatbot.js   uses lib/search.js; Claude rewrites the answer if ANTHROPIC_API_KEY is set
├── public/                        single-page app, no build step, no external CDN
│   ├── index.html                 shell: header, <main>, footer
│   ├── css/style.css              all styling (design tokens at the top: dark + light)
│   └── js/
│       ├── theme.js               applies saved theme before first paint
│       ├── api.js                 fetch helper, login state, small shared helpers
│       ├── layout.js              header, nav, categories dropdown, mobile menu, theme toggle
│       ├── app.js                 hash router: #/  #/shop/3  #/login  #/dashboard
│       └── views/                 home.js, shop.js, login.js, dashboard.js
└── data/                     SQLite file is created here
```

## How search works
Each shop lists what it repairs ("hair dryer, iron box, refrigerator"). A search like "hair drier repair shop" is matched to the item *hair dryer* (typos and aliases are handled in `server/lib/search.js`). Shops that list it are "exact" matches. Shops in the same category are "related" ("might handle it, ask first"). Add new items and aliases in `ITEMS`.

The app is login-first: every page except the login screen redirects to `#/login`, and the shop API needs a token.

## Design notes
- Black base, warm off-white text, one soft amber accent, light green and coral for open/closed and stock. Always starts dark; the ◐ button switches to a light option. All colours are tokens at the top of `css/style.css`.
- Responsive from 320px up: filters become a scrolling chip row, the nav becomes a menu with a fully expanding categories list, and lists replace tables so nothing scrolls sideways.

## Main API
| Method | Path | Who |
|---|---|---|
| GET | /api/meta (groups and repair types) | logged in |
| GET | /api/shops?q=&group=&type=&lat=&lng=&open=1 | logged in |
| GET | /api/shops/:id | logged in |
| POST/PUT | /api/shops, /api/shops/:id | owner |
| PATCH | /api/shops/:id/availability | owner |
| POST/DELETE | /api/shops/:id/services, /spares | owner |
| POST | /api/shops/:id/reviews | customer |
| POST | /api/chat  `{shop_id, message}` | logged in |
| POST | /api/enquiries `{shop_ids, item, message}` | customer |
| GET | /api/enquiries/mine, /api/enquiries/shop | customer, owner |
| POST | /api/enquiries/:id/reply `{available, reply}` | owner |
| POST | /api/bookings | customer |
| PATCH | /api/bookings/:id/status | owner or customer |
| POST | /api/payments/checkout, /confirm | customer |

## Next steps
1. Real payments: follow the Razorpay notes at the top of `server/routes/payments.js`.
2. Map view: add Leaflet + OpenStreetMap on `index.html` using each shop's lat/lng.
3. Live availability: add SSE or WebSocket so "Open now" and stock update instantly.
4. Move SQLite to PostgreSQL once you have many shops.
5. Shop photo upload, owner verification (GST / shop licence), SMS/WhatsApp booking alerts.
6. Use HTTPS and set a strong `JWT_SECRET` before going live.
