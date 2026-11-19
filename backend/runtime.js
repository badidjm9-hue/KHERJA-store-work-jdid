'use strict';
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const EXPECTED_NODE = 'v22.23.4';
function assertSupportedRuntime({ secure = true, version = process.version } = {}) {
  if (version !== EXPECTED_NODE) {
    const msg = `unsupported Node.js ${version}; this checkpoint is pinned to ${EXPECTED_NODE}`;
    if (secure) throw new Error(msg);
    console.warn('kherja: ' + msg + ' (development only; continuing)');
    return false;
  }
  return true;
}
function runSqliteCanaries() {
  const db = new DatabaseSync(':memory:');
  let dir, diskA, diskB;
  try {
    db.exec('create table canary(id integer primary key, value text not null unique); insert into canary(value) values (\'ok\')');
    const named = db.prepare('select value from canary where id=:id').get({ id: 1 });
    if (!named || named.value !== 'ok') throw new Error('SQLite named-parameter canary failed');
    if (db.prepare('select value from canary where id=:id').get({ id: 999 }) !== undefined) throw new Error('SQLite no-row canary failed');
    db.exec('create table canary_log(value text); create trigger canary_trigger after insert on canary begin insert into canary_log values(new.value); end; insert into canary(value) values (\'triggered\')');
    if (db.prepare('select count(*) n from canary_log').get().n !== 1) throw new Error('SQLite trigger canary failed');
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-runtime-'));
    const file = path.join(dir, 'wal-canary.db');
    diskA = new DatabaseSync(file);
    const mode = diskA.prepare('pragma journal_mode=wal').get().journal_mode;
    if (String(mode).toLowerCase() !== 'wal') throw new Error('SQLite WAL mode canary failed');
    diskA.exec('create table wal_check(value text); insert into wal_check values (\'committed\')');
    diskB = new DatabaseSync(file);
    if (diskB.prepare('select value from wal_check').get().value !== 'committed') throw new Error('SQLite WAL cross-connection visibility canary failed');
    return { node: process.version, sqlite: process.versions.sqlite, ok: true };
  } finally {
    try { diskB?.close(); } catch {}
    try { diskA?.close(); } catch {}
    db.close();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
}
module.exports = { EXPECTED_NODE, assertSupportedRuntime, runSqliteCanaries };
