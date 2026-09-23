const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const Database = require('better-sqlite3');

const root = path.join(__dirname, '..');

function runStore(code, dir, dbPath) {
  const result = spawnSync(process.execPath, ['-e', code], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, DATA_DIR: dir, DB_PATH: dbPath }
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('VPS storage removes only in-group email/password duplicates and keeps a backup', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-dedupe-'));
  const dbPath = path.join(dir, 'mail.db');
  try {
    const seed = new Database(dbPath);
    seed.exec(`
      CREATE TABLE emails (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        password TEXT NOT NULL DEFAULT '',
        client_id TEXT NOT NULL DEFAULT '',
        refresh_token TEXT NOT NULL DEFAULT '',
        group_name TEXT NOT NULL DEFAULT '默认分组',
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    const insert = seed.prepare('INSERT INTO emails (email, password, group_name, note) VALUES (?, ?, ?, ?)');
    insert.run('Alice@Example.com', 'Secret', 'A', 'first');
    insert.run(' alice@example.com ', 'Secret', 'A', 'duplicate');
    insert.run('alice@example.com', 'Other', 'A', 'different password');
    insert.run('alice@example.com', 'Secret', 'B', 'different group');
    insert.run('alice@example.com', 'secret', 'A', 'password case differs');
    seed.close();

    runStore(`const assert = require('node:assert/strict');
      const store = require('./store-db');
      assert.equal(store.getState().emails.length, 4);`, dir, dbPath);

    const backupPath = fs.readdirSync(dir).find(name => name.includes('.pre-dedupe-') && name.endsWith('.db'));
    assert.ok(backupPath, 'a consistent backup is required before deletion');
    const backup = new Database(path.join(dir, backupPath), { readonly: true });
    assert.equal(backup.prepare('SELECT COUNT(*) AS count FROM emails').get().count, 5);
    backup.close();

    const migrated = new Database(dbPath);
    assert.equal(migrated.prepare('SELECT COUNT(*) AS count FROM emails').get().count, 4);
    assert.equal(migrated.prepare('SELECT note FROM emails WHERE email = ?').get('Alice@Example.com').note, 'first');
    assert.throws(() => insertInto(migrated, 'ALICE@example.com', 'Secret', 'A'));
    migrated.close();

    runStore(`const assert = require('node:assert/strict');
      const store = require('./store-db');
      const records = [
        { email: 'user@example.com', password: 'pw', group: 'A' },
        { email: 'USER@example.com', password: 'pw', group: 'A' },
        { email: 'user@example.com', password: 'pw2', group: 'A' },
        { email: 'user@example.com', password: 'pw', group: 'B' }
      ];
      assert.equal(store.replaceEmails(records).emails.length, 3);`, dir, dbPath);

    const finalDb = new Database(dbPath, { readonly: true });
    assert.equal(finalDb.prepare('SELECT COUNT(*) AS count FROM emails').get().count, 3);
    finalDb.close();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function insertInto(db, email, password, group) {
  db.prepare('INSERT INTO emails (email, password, group_name) VALUES (?, ?, ?)').run(email, password, group);
}
