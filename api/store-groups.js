module.exports = async (req, res) => {
    if (process.env.VERCEL) {
        return res.status(501).json({ error: 'VPS database storage is not available on Vercel' });
    }

    if (req.method !== 'PUT' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const store = require('../store-db');
    const groups = Array.isArray(req.body?.groups) ? req.body.groups : [];
    return res.status(200).json(store.replaceGroups(groups));
};
