const path = require('path');
const express = require('express');
require('dotenv').config();

const app = express();
const publicDir = path.join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '0.0.0.0';

app.set('trust proxy', true);
app.disable('x-powered-by');

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/api', (req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    next();
});

app.get('/healthz', (req, res) => {
    res.json({ ok: true });
});

const routes = [
    'ai',
    'mail-all',
    'mail-new',
    'process-inbox',
    'process-junk',
    'refresh-token',
    'send-mail',
    'store-emails',
    'store-groups',
    'store-state'
];

for (const route of routes) {
    const handler = require(path.join(__dirname, 'api', `${route}.js`));
    app.all(`/api/${route}`, (req, res, next) => {
        Promise.resolve(handler(req, res)).catch(next);
    });
}

app.use('/assets', express.static(path.join(publicDir, 'assets'), {
    immutable: true,
    maxAge: '1y'
}));

app.get('/mail.html', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(publicDir, 'mail.html'));
});

app.use(express.static(publicDir));

app.use((req, res) => {
    res.status(404).sendFile(path.join(publicDir, '404.html'));
});

app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

if (require.main === module) {
    app.listen(port, host, () => {
        console.log(`MS OAuth2 API listening on http://${host}:${port}`);
    });
}

module.exports = app;
