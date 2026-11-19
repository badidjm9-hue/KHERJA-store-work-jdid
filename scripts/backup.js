'use strict';
// Offline, consistent SQLite + upload backup. Stop the Kherja service before running.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
// lstat-based: a dangling symlink counts as existing, so it is never replaced.
function exists(p) { try { fs.lstatSync(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
// Resolves symlinks in the deepest existing ancestor; the remaining (not yet created) tail is appended.
function real(p) { let cur = path.resolve(p); const tail = []; for (;;) { try { return path.join(fs.realpathSync(cur), ...tail.reverse()); } catch (e) { if (e.code !== 'ENOENT') throw e; const up = path.dirname(cur); if (up === cur) throw e; tail.push(path.basename(cur)); cur = up; } } }
function isInside(parent, child) { const rel = path.relative(parent, child); return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function walk(dir, base = dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(d => {
    const abs = path.join(dir, d.name), rel = path.relative(base, abs).split(path.sep).join('/');
    if (d.isSymbolicLink()) throw new Error('symlink not allowed in uploads: ' + rel);
    if (d.isDirectory()) return walk(abs, base);
    if (!d.isFile()) throw new Error('unsupported upload entry: ' + rel);
    return [{ path: rel, sha256: hash(abs), size: fs.statSync(abs).size }];
  });
}
function main() {
  const dbPath = process.env.DB_PATH || 'kherja.db';
  if (dbPath === ':memory:' || dbPath.startsWith('file:')) throw new Error('backup requires a file-backed DB_PATH');
  const db = path.resolve(dbPath), upload = path.resolve(process.env.UPLOAD_DIR || path.join(path.dirname(db), 'uploads'));
  if (!fs.existsSync(db)) throw new Error('database file not found: ' + db);
  const outArg = process.argv[2]; if (!outArg) throw new Error('usage: node scripts/backup.js <new-backup-directory>');
  const out = path.resolve(outArg); if (exists(out)) throw new Error('backup destination already exists');
  if (isInside(real(upload), real(db))) throw new Error('UPLOAD_DIR must not equal or contain the database file');
  if (isInside(real(upload), real(out))) throw new Error('backup destination must not be inside the upload directory');
  fs.mkdirSync(path.dirname(out), { recursive: true, mode: 0o700 });
  const stage = out + '.tmp-' + process.pid; if (exists(stage)) throw new Error('staging path already exists');
  fs.mkdirSync(stage, { mode: 0o700 }); let source;
  try {
    source = new DatabaseSync(db);
    const integrity = source.prepare('pragma integrity_check').get();
    if (!integrity || integrity.integrity_check !== 'ok') throw new Error('source database integrity_check failed');
    const snapshot = path.join(stage, 'database.sqlite');
    source.exec(`vacuum into '${snapshot.replace(/'/g, "''")}'`);
    fs.chmodSync(snapshot, 0o600);
    source.close(); source = null;
    const uploadsDir = path.join(stage, 'uploads'); fs.mkdirSync(uploadsDir, { mode: 0o700 });
    const files = walk(upload);
    for (const f of files) { const from = path.join(upload, ...f.path.split('/')), to = path.join(uploadsDir, ...f.path.split('/')); fs.mkdirSync(path.dirname(to), { recursive: true, mode: 0o700 }); fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); fs.chmodSync(to, 0o600); }
    const manifest = { format: 'kherja-backup-v1', created_at: new Date().toISOString(), source_db_basename: path.basename(db), database: { path: 'database.sqlite', sha256: hash(snapshot), size: fs.statSync(snapshot).size }, uploads: files };
    fs.writeFileSync(path.join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(stage, out);
    console.log(JSON.stringify({ ok: true, backup: out, upload_files: files.length, database_sha256: manifest.database.sha256 }));
  } catch (e) { try { source?.close(); } catch {} fs.rmSync(stage, { recursive: true, force: true }); throw e; }
}
try { main(); } catch (e) { console.error('backup failed: ' + e.message); process.exitCode = 1; }
