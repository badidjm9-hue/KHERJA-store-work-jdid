'use strict';
// Restores a verified backup into a NEW directory; never overwrites an existing target.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
// lstat-based: a dangling symlink counts as existing, so it is never replaced.
function exists(p) { try { fs.lstatSync(p); return true; } catch (e) { if (e.code === 'ENOENT') return false; throw e; } }
function real(p) { let cur = path.resolve(p); const tail = []; for (;;) { try { return path.join(fs.realpathSync(cur), ...tail.reverse()); } catch (e) { if (e.code !== 'ENOENT') throw e; const up = path.dirname(cur); if (up === cur) throw e; tail.push(path.basename(cur)); cur = up; } } }
function isInside(parent, child) { const rel = path.relative(parent, child); return rel === '' || (rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel)); }
function hash(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function inside(root, rel) { if (typeof rel !== 'string' || !rel || path.isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) throw new Error('unsafe manifest path'); const base = path.resolve(root), p = path.resolve(base, rel); if (!p.startsWith(base + path.sep)) throw new Error('manifest path escapes backup'); let cur = base; for (const part of path.relative(base, p).split(path.sep)) { cur = path.join(cur, part); if (fs.existsSync(cur) && fs.lstatSync(cur).isSymbolicLink()) throw new Error('symlink not allowed in backup: ' + rel); } return p; }
function main() {
  const backup = path.resolve(process.argv[2] || ''), target = path.resolve(process.argv[3] || '');
  if (!process.argv[2] || !process.argv[3]) throw new Error('usage: node scripts/restore.js <backup-directory> <new-target-directory>');
  if (!fs.statSync(backup).isDirectory()) throw new Error('backup path is not a directory');
  if (exists(target)) throw new Error('restore target already exists; refusing to overwrite');
  if (isInside(real(backup), real(target))) throw new Error('restore target must not be inside the backup directory');
  const manifestPath = path.join(backup, 'manifest.json'); const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.format !== 'kherja-backup-v1' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(manifest.source_db_basename || '')) throw new Error('unsupported or invalid backup manifest');
  const db = inside(backup, manifest.database?.path);
  if (!fs.statSync(db).isFile() || hash(db) !== manifest.database.sha256) throw new Error('database checksum mismatch');
  const checkDb = new DatabaseSync(db, { readOnly: true });
  try { const result = checkDb.prepare('pragma integrity_check').get(); if (!result || result.integrity_check !== 'ok') throw new Error('database integrity_check failed'); } finally { checkDb.close(); }
  if (!Array.isArray(manifest.uploads)) throw new Error('invalid uploads manifest');
  { const up = path.join(backup, 'uploads'); if (exists(up) && !fs.lstatSync(up).isDirectory()) throw new Error('uploads must be a real directory, not a symlink'); }
  for (const f of manifest.uploads) { const p = inside(path.join(backup, 'uploads'), f.path); if (!fs.statSync(p).isFile() || hash(p) !== f.sha256) throw new Error('upload checksum mismatch: ' + f.path); }
  fs.mkdirSync(path.dirname(target), { recursive: true, mode: 0o700 }); const stage = target + '.restore-' + process.pid;
  if (exists(stage)) throw new Error('restore staging path exists');
  fs.mkdirSync(stage, { mode: 0o700 });
  try {
    fs.copyFileSync(db, path.join(stage, manifest.source_db_basename), fs.constants.COPYFILE_EXCL); fs.chmodSync(path.join(stage, manifest.source_db_basename), 0o600);
    const uploads = path.join(stage, 'uploads'); fs.mkdirSync(uploads, { mode: 0o700 });
    for (const f of manifest.uploads) { const from = inside(path.join(backup, 'uploads'), f.path), to = inside(uploads, f.path); fs.mkdirSync(path.dirname(to), { recursive: true, mode: 0o700 }); fs.copyFileSync(from, to, fs.constants.COPYFILE_EXCL); fs.chmodSync(to, 0o600); }
    fs.renameSync(stage, target); console.log(JSON.stringify({ ok: true, restored_to: target, database: manifest.source_db_basename, upload_files: manifest.uploads.length }));
  } catch (e) { fs.rmSync(stage, { recursive: true, force: true }); throw e; }
}
try { main(); } catch (e) { console.error('restore failed: ' + e.message); process.exitCode = 1; }
