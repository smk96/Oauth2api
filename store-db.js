const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
const dbPath = process.env.DB_PATH || path.join(dataDir, 'mail.db');

fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS groups (
    name TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS emails (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL,
    password TEXT NOT NULL DEFAULT '',
    client_id TEXT NOT NULL DEFAULT '',
    refresh_token TEXT NOT NULL DEFAULT '',
    group_name TEXT NOT NULL DEFAULT '默认分组',
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_emails_group_name ON emails(group_name);
  CREATE INDEX IF NOT EXISTS idx_emails_email ON emails(email);
`);

db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)').run('默认分组');

const normalizeItem = (item = {}) => ({
    id: item.id ?? null,
    email: item.email || '',
    password: item.password || '',
    clientId: item.clientId || item.client_id || '',
    refreshToken: item.refreshToken || item.refresh_token || '',
    group: item.group || item.group_name || '默认分组',
    note: item.note || ''
});

const rowToItem = (row) => ({
    id: row.id,
    email: row.email,
    password: row.password,
    clientId: row.client_id,
    refreshToken: row.refresh_token,
    group: row.group_name,
    note: row.note
});

function getState() {
    const groups = db.prepare('SELECT name FROM groups ORDER BY CASE WHEN name = ? THEN 0 ELSE 1 END, created_at, name')
        .all('默认分组')
        .map(row => row.name);
    const emails = db.prepare('SELECT * FROM emails ORDER BY id ASC').all().map(rowToItem);
    return { groups, emails };
}

const replaceEmailsTx = db.transaction((items) => {
    db.prepare('DELETE FROM emails').run();
    const insertEmail = db.prepare(`
      INSERT INTO emails (email, password, client_id, refresh_token, group_name, note, updated_at)
      VALUES (@email, @password, @clientId, @refreshToken, @group, @note, CURRENT_TIMESTAMP)
    `);
    const insertGroup = db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)');
    for (const raw of items || []) {
        const item = normalizeItem(raw);
        if (!item.email) continue;
        insertGroup.run(item.group);
        insertEmail.run(item);
    }
});

const replaceGroupsTx = db.transaction((groups) => {
    const next = [...new Set(['默认分组', ...(groups || []).filter(Boolean)])];
    const existing = new Set(next);
    const insertGroup = db.prepare('INSERT OR IGNORE INTO groups (name) VALUES (?)');
    for (const group of next) insertGroup.run(group);
    for (const row of db.prepare('SELECT name FROM groups').all()) {
        if (row.name !== '默认分组' && !existing.has(row.name)) {
            db.prepare('UPDATE emails SET group_name = ?, updated_at = CURRENT_TIMESTAMP WHERE group_name = ?')
                .run('默认分组', row.name);
            db.prepare('DELETE FROM groups WHERE name = ?').run(row.name);
        }
    }
});

function replaceEmails(items) {
    replaceEmailsTx(items);
    return getState();
}

function replaceGroups(groups) {
    replaceGroupsTx(groups);
    return getState();
}

module.exports = {
    dbPath,
    getState,
    replaceEmails,
    replaceGroups
};
