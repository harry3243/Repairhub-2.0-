require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
require('./db');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/shops', require('./routes/shops'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/enquiries', require('./routes/enquiries'));
app.get('/api/meta', require('./middleware/auth').auth(), (req, res) => res.json({ groups: require('./lib/search').GROUPS }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));
app.use((err, req, res, next) => { console.error(err); res.status(500).json({ error: 'Something went wrong on our side.' }); });

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`RepairHub running at http://localhost:${PORT}`));
