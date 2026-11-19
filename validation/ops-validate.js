'use strict';
// Isolated ops validation. Usage: node ops-validate.js <project-root>
// Everything happens under a fresh mkdtemp directory. The project tree is only read.
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), crypto = require('node:crypto'), http = require('node:http');
const { spawn, spawnSync } = require('node:child_process');
const { DatabaseSync } = require('node:sqlite');
const ROOT = path.resolve(process.argv[2]);
const SERVER = path.join(ROOT, 'backend/server.js'), BACKUP = path.join(ROOT, 'scripts/backup.js'), RESTORE = path.join(ROOT, 'scripts/restore.js');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kherja-opsval-'));
const results = []; const check = (id, ok, detail = '') => { results.push({ id, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + id + (detail ? ' :: ' + detail : '')); };
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const mode = f => (fs.statSync(f).mode & 0o777).toString(8);
const tree = d => { const o = {}; const w = (p, b) => { for (const e of fs.readdirSync(p, { withFileTypes: true })) { const a = path.join(p, e.name), r = path.relative(b, a); if (e.isDirectory()) { o[r + '/'] = 1; w(a, b); } else o[r] = sha(a); } }; w(d, d); return JSON.stringify(o); };
const leftovers = dir => fs.readdirSync(dir).filter(n => /\.tmp-|\.restore-/.test(n));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function startServer(env, { until = /kherja api on ([^:\s]+):(\d+)/ } = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(process.execPath, [SERVER], { env: { PATH: process.env.PATH, ...env }, cwd: TMP });
    let out = '', err = '', done = false;
    const t = setTimeout(() => { if (!done) { done = true; c.kill('SIGKILL'); reject(new Error('start timeout ' + out + err)); } }, 15000);
    c.stdout.on('data', d => { out += d; const m = until.exec(out); if (m && !done) { done = true; clearTimeout(t); resolve({ child: c, port: Number(m[2]), out: () => out, err: () => err }); } });
    c.stderr.on('data', d => { err += d; });
    c.on('exit', (code, sig) => { if (!done) { done = true; clearTimeout(t); resolve({ exited: true, code, sig, out, err }); } });
  });
}
const exitOf = (srv, ms = 12000) => new Promise(res => { if (srv.child.exitCode !== null || srv.child.signalCode) return res({ code: srv.child.exitCode, sig: srv.child.signalCode }); const t = setTimeout(() => res({ timeout: true }), ms); srv.child.on('exit', (code, sig) => { clearTimeout(t); res({ code, sig }); }); });
function req(port, method, p, body, headers = {}, agent) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : JSON.stringify(body);
    const r = http.request({ host: '127.0.0.1', port, method, path: p, agent, headers: { ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...headers } }, res => { let s = ''; res.on('data', d => s += d); res.on('end', () => { let j = null; try { j = JSON.parse(s); } catch {} resolve({ status: res.statusCode, json: j, text: s, headers: res.headers }); }); });
    r.on('error', reject); if (data) r.write(data); r.end();
  });
}
const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), crypto.randomBytes(600)]);

(async () => {
  console.log('NODE', process.version, 'SQLITE', process.versions.sqlite, 'TMP', TMP, 'uid', process.getuid());
  // ---------- 1. WAL-active backup ----------
  const data = path.join(TMP, 'data'); fs.mkdirSync(data, { mode: 0o755 }); fs.chmodSync(data, 0o755);
  const dbFile = path.join(data, 'kherja.db'), upDir = path.join(data, 'uploads');
  const srv = await startServer({ KHERJA_DEV: '1', PORT: '0', HOST: '127.0.0.1', DB_PATH: dbFile, UPLOAD_DIR: upDir });
  check('server.start', !srv.exited, srv.exited ? srv.err : 'port ' + srv.port);
  const verify = async (phone, role, name) => { const o = await req(srv.port, 'POST', '/api/auth/otp', { phone }); const v = await req(srv.port, 'POST', '/api/auth/verify', { phone, code: '123456', role, name }); return v.headers['set-cookie'][0].split(';')[0]; };
  const dCookie = await verify('0666000011', 'driver', 'Drv'); await verify('0555000012', 'rider', 'Rid');
  const pr = await req(srv.port, 'POST', '/api/driver/profile', { car: 'Symbol', plate: '12345-116-11', name: 'Drv' }, { Cookie: dCookie });
  const up = await req(srv.port, 'POST', '/api/driver/docs', { kind: 'license', data: png.toString('base64') }, { Cookie: dCookie });
  check('seed.driver_doc_upload', pr.status === 200 && up.status === 200, JSON.stringify([pr.status, up.status]));
  for (let i = 0; i < 5; i++) await req(srv.port, 'POST', '/api/waitlist', { phone: '055500' + String(1000 + i).slice(1), name: 'w' + i, email: `w${i}@example.com`, role: 'rider' }).catch(() => {});
  // extra manual upload with subdirectory + odd bytes
  const walSize = fs.existsSync(dbFile + '-wal') ? fs.statSync(dbFile + '-wal').size : 0;
  check('wal.active_before_backup', walSize > 0, 'wal bytes=' + walSize);
  const mainHasData = (() => { const d = new DatabaseSync(dbFile, { readOnly: true }); try { return d.prepare('select count(*) n from users').get().n; } finally { d.close(); } })();
  // Perms of live files (umask 022 inherited)
  const live = { db: mode(dbFile), wal: mode(dbFile + '-wal'), shm: fs.existsSync(dbFile + '-shm') ? mode(dbFile + '-shm') : 'none', uploads: mode(upDir), file: mode(path.join(upDir, fs.readdirSync(upDir)[0])) };
  console.log('LIVE_PERMS', JSON.stringify(live));
  check('perm.live_db_0600', live.db === '600', live.db);
  check('perm.live_wal_0600', live.wal === '600', live.wal);
  check('perm.live_shm_0600', live.shm === '600' || live.shm === 'none', live.shm);
  check('perm.uploads_dir_0700', live.uploads === '700', live.uploads);
  check('perm.upload_file_0600', live.file === '600', live.file);
  // concurrent writer during backup
  let stop = false; let writes = 0; const writer = (async () => { while (!stop) { const r = await req(srv.port, 'POST', '/api/waitlist', { phone: '0555009999', name: 'x', email: 'x@example.com', role: 'rider' }).catch(() => null); writes++; await sleep(5); } })();
  const bdir = path.join(TMP, 'bk', 'backup1');
  const b = spawnSync(process.execPath, [BACKUP, bdir], { env: { PATH: process.env.PATH, DB_PATH: dbFile, UPLOAD_DIR: upDir }, encoding: 'utf8', cwd: TMP });
  stop = true; await writer;
  check('backup.while_wal_active_exit0', b.status === 0, (b.stderr || b.stdout).trim().slice(0, 200) + ' concurrent_writes=' + writes);
  const man = JSON.parse(fs.readFileSync(path.join(bdir, 'manifest.json'), 'utf8'));
  check('backup.manifest_format', man.format === 'kherja-backup-v1' && man.uploads.length === 1);
  check('backup.db_checksum_matches_manifest', sha(path.join(bdir, 'database.sqlite')) === man.database.sha256);
  const snap = new DatabaseSync(path.join(bdir, 'database.sqlite'), { readOnly: true });
  const snapCounts = { users: snap.prepare('select count(*) n from users').get().n, drivers: snap.prepare('select count(*) n from drivers').get().n, docs: snap.prepare('select count(*) n from driver_docs').get().n };
  check('backup.snapshot_integrity_ok', snap.prepare('pragma integrity_check').get().integrity_check === 'ok');
  check('backup.snapshot_contains_wal_only_rows', snapCounts.users === 2 && snapCounts.drivers === 1 && snapCounts.docs === 1, JSON.stringify(snapCounts) + ' mainfile_users_at_check=' + mainHasData);
  snap.close();
  console.log('BACKUP_PERMS', JSON.stringify({ dir: mode(bdir), db: mode(path.join(bdir, 'database.sqlite')), manifest: mode(path.join(bdir, 'manifest.json')), upload: mode(path.join(bdir, 'uploads', man.uploads[0].path)) }));
  check('perm.backup_dir_0700', mode(bdir) === '700', mode(bdir));
  check('perm.backup_snapshot_0600', mode(path.join(bdir, 'database.sqlite')) === '600', mode(path.join(bdir, 'database.sqlite')));
  check('backup.no_staging_leftover', leftovers(path.join(TMP, 'bk')).length === 0, leftovers(path.join(TMP, 'bk')).join(','));
  // ---------- 2. Restore ----------
  const rdir = path.join(TMP, 'restore', 'r1');
  const r = spawnSync(process.execPath, [RESTORE, bdir, rdir], { encoding: 'utf8' });
  check('restore.separate_destination_exit0', r.status === 0, (r.stderr || r.stdout).trim().slice(0, 200));
  const rdb = new DatabaseSync(path.join(rdir, 'kherja.db'), { readOnly: true });
  check('restore.integrity_ok', rdb.prepare('pragma integrity_check').get().integrity_check === 'ok');
  const rc = { users: rdb.prepare('select count(*) n from users').get().n, drivers: rdb.prepare('select count(*) n from drivers').get().n, docs: rdb.prepare('select count(*) n from driver_docs').get().n, wl: rdb.prepare('select count(*) n from waitlist').get().n };
  check('restore.records_match_source', rc.users === 2 && rc.drivers === 1 && rc.docs === 1, JSON.stringify(rc));
  const docRow = rdb.prepare('select file,size from driver_docs').get(); rdb.close();
  check('restore.upload_preserved_bytes', sha(path.join(rdir, 'uploads', docRow.file)) === sha(path.join(upDir, docRow.file)) && fs.statSync(path.join(rdir, 'uploads', docRow.file)).size === docRow.size);
  check('restore.upload_checksum_matches_manifest', man.uploads.every(u => sha(path.join(rdir, 'uploads', u.path)) === u.sha256));
  check('restore.source_db_untouched_by_scripts', fs.existsSync(dbFile) && !fs.existsSync(path.join(data, 'kherja.db.restore')), '');
  console.log('RESTORE_PERMS', JSON.stringify({ dir: mode(rdir), uploads: mode(path.join(rdir, 'uploads')), db: mode(path.join(rdir, 'kherja.db')), file: mode(path.join(rdir, 'uploads', docRow.file)) }));
  // ---------- 3. Overwrite protection ----------
  const before = tree(rdir);
  const r2 = spawnSync(process.execPath, [RESTORE, bdir, rdir], { encoding: 'utf8' });
  check('overwrite.restore_existing_dir_refused', r2.status === 1 && /already exists/.test(r2.stderr) && tree(rdir) === before, r2.stderr.trim());
  const beforeB = tree(bdir);
  const b2 = spawnSync(process.execPath, [BACKUP, bdir], { env: { PATH: process.env.PATH, DB_PATH: dbFile, UPLOAD_DIR: upDir }, encoding: 'utf8' });
  check('overwrite.backup_existing_dir_refused', b2.status === 1 && /already exists/.test(b2.stderr) && tree(bdir) === beforeB, b2.stderr.trim());
  const fileTarget = path.join(TMP, 'restore', 'afile'); fs.writeFileSync(fileTarget, 'keep');
  const r3 = spawnSync(process.execPath, [RESTORE, bdir, fileTarget], { encoding: 'utf8' });
  check('overwrite.restore_onto_file_refused', r3.status === 1 && fs.readFileSync(fileTarget, 'utf8') === 'keep');
  const linkTarget = path.join(TMP, 'restore', 'linkdir'); fs.mkdirSync(path.join(TMP, 'precious')); fs.writeFileSync(path.join(TMP, 'precious', 'p.txt'), 'precious'); fs.symlinkSync(path.join(TMP, 'precious'), linkTarget);
  const r4 = spawnSync(process.execPath, [RESTORE, bdir, linkTarget], { encoding: 'utf8' });
  check('overwrite.restore_onto_symlink_to_dir_refused', r4.status === 1 && fs.readdirSync(path.join(TMP, 'precious')).join() === 'p.txt', r4.stderr.trim());
  const dangling = path.join(TMP, 'restore', 'dangling'); fs.symlinkSync(path.join(TMP, 'nowhere'), dangling);
  const r5 = spawnSync(process.execPath, [RESTORE, bdir, dangling], { encoding: 'utf8' });
  check('overwrite.restore_onto_dangling_symlink_refused', r5.status === 1 && fs.lstatSync(dangling).isSymbolicLink(), 'status=' + r5.status + ' ' + (r5.stderr || r5.stdout).trim().slice(0, 150));
  const dangB = path.join(TMP, 'bk', 'dangling'); fs.symlinkSync(path.join(TMP, 'nowhere2'), dangB);
  const b3 = spawnSync(process.execPath, [BACKUP, dangB], { env: { PATH: process.env.PATH, DB_PATH: dbFile, UPLOAD_DIR: upDir }, encoding: 'utf8' });
  check('overwrite.backup_onto_dangling_symlink_refused', b3.status === 1 && fs.lstatSync(dangB).isSymbolicLink(), 'status=' + b3.status + ' ' + (b3.stderr || b3.stdout).trim().slice(0, 150));
  // ---------- 4. Failure cleanup ----------
  const cleanRoot = path.join(TMP, 'fail'); fs.mkdirSync(cleanRoot);
  // 4a backup: symlink inside uploads
  const upBad = path.join(TMP, 'up-bad'); fs.mkdirSync(upBad); fs.writeFileSync(path.join(upBad, 'a.jpg'), 'a'); fs.symlinkSync('/etc/passwd', path.join(upBad, 'evil'));
  const fb1 = spawnSync(process.execPath, [BACKUP, path.join(cleanRoot, 'bk-sym')], { env: { PATH: process.env.PATH, DB_PATH: dbFile, UPLOAD_DIR: upBad }, encoding: 'utf8' });
  check('cleanup.backup_fail_symlink_in_uploads', fb1.status === 1 && /symlink/.test(fb1.stderr) && fs.readdirSync(cleanRoot).length === 0, fb1.stderr.trim() + ' left=' + fs.readdirSync(cleanRoot).join());
  // 4b backup: FIFO in uploads
  const upFifo = path.join(TMP, 'up-fifo'); fs.mkdirSync(upFifo); spawnSync('mkfifo', [path.join(upFifo, 'pipe')]);
  const fb2 = spawnSync(process.execPath, [BACKUP, path.join(cleanRoot, 'bk-fifo')], { env: { PATH: process.env.PATH, DB_PATH: dbFile, UPLOAD_DIR: upFifo }, encoding: 'utf8' });
  check('cleanup.backup_fail_special_file', fb2.status === 1 && fs.readdirSync(cleanRoot).length === 0, fb2.stderr.trim() + ' left=' + fs.readdirSync(cleanRoot).join());
  // 4c backup: corrupt source DB
  const corrupt = path.join(TMP, 'corrupt.db'); fs.copyFileSync(path.join(bdir, 'database.sqlite'), corrupt); const fd = fs.openSync(corrupt, 'r+'); fs.writeSync(fd, crypto.randomBytes(4096), 0, 4096, 4096 * 2); fs.closeSync(fd);
  const fb3 = spawnSync(process.execPath, [BACKUP, path.join(cleanRoot, 'bk-corrupt')], { env: { PATH: process.env.PATH, DB_PATH: corrupt, UPLOAD_DIR: upDir }, encoding: 'utf8' });
  check('cleanup.backup_fail_corrupt_db', fb3.status === 1 && fs.readdirSync(cleanRoot).length === 0, fb3.stderr.trim().slice(0, 120) + ' left=' + fs.readdirSync(cleanRoot).join());
  // 4d backup: missing DB must not create one
  const fb4 = spawnSync(process.execPath, [BACKUP, path.join(cleanRoot, 'bk-missing')], { env: { PATH: process.env.PATH, DB_PATH: path.join(TMP, 'absent.db'), UPLOAD_DIR: upDir }, encoding: 'utf8' });
  check('cleanup.backup_fail_missing_db_creates_nothing', fb4.status === 1 && !fs.existsSync(path.join(TMP, 'absent.db')) && fs.readdirSync(cleanRoot).length === 0, fb4.stderr.trim());
  // 4e restore: tampered DB
  const mk = n => { const d = path.join(TMP, 'bkcopy-' + n); fs.cpSync(bdir, d, { recursive: true }); return d; };
  const t1 = mk('db'); const fdb = fs.openSync(path.join(t1, 'database.sqlite'), 'r+'); fs.writeSync(fdb, Buffer.from([0xff]), 0, 1, 4000); fs.closeSync(fdb);
  const rr1 = spawnSync(process.execPath, [RESTORE, t1, path.join(cleanRoot, 'r-db')], { encoding: 'utf8' });
  check('cleanup.restore_fail_tampered_db', rr1.status === 1 && /checksum mismatch/.test(rr1.stderr) && fs.readdirSync(cleanRoot).length === 0, rr1.stderr.trim() + ' left=' + fs.readdirSync(cleanRoot).join());
  // 4f restore: tampered upload
  const t2 = mk('up'); fs.appendFileSync(path.join(t2, 'uploads', man.uploads[0].path), 'x');
  const rr2 = spawnSync(process.execPath, [RESTORE, t2, path.join(cleanRoot, 'r-up')], { encoding: 'utf8' });
  check('cleanup.restore_fail_tampered_upload', rr2.status === 1 && /upload checksum mismatch/.test(rr2.stderr) && fs.readdirSync(cleanRoot).length === 0, rr2.stderr.trim() + ' left=' + fs.readdirSync(cleanRoot).join());
  // 4g restore: mid-copy failure (duplicate manifest entry -> COPYFILE_EXCL throws after staging started)
  const t3 = mk('dup'); const m3 = JSON.parse(fs.readFileSync(path.join(t3, 'manifest.json'), 'utf8')); m3.uploads.push(m3.uploads[0]); fs.writeFileSync(path.join(t3, 'manifest.json'), JSON.stringify(m3));
  const rr3 = spawnSync(process.execPath, [RESTORE, t3, path.join(cleanRoot, 'r-dup')], { encoding: 'utf8' });
  check('cleanup.restore_fail_midcopy_removes_staging', rr3.status === 1 && fs.readdirSync(cleanRoot).length === 0, rr3.stderr.trim().slice(0, 120) + ' left=' + fs.readdirSync(cleanRoot).join());
  // 4h restore: corrupt-but-checksum-consistent DB (integrity_check path)
  const t4 = mk('integ'); const fdi = fs.openSync(path.join(t4, 'database.sqlite'), 'r+'); fs.writeSync(fdi, crypto.randomBytes(4096), 0, 4096, 4096 * 2); fs.closeSync(fdi);
  const m4 = JSON.parse(fs.readFileSync(path.join(t4, 'manifest.json'), 'utf8')); m4.database.sha256 = sha(path.join(t4, 'database.sqlite')); fs.writeFileSync(path.join(t4, 'manifest.json'), JSON.stringify(m4));
  const rr4 = spawnSync(process.execPath, [RESTORE, t4, path.join(cleanRoot, 'r-integ')], { encoding: 'utf8' });
  check('cleanup.restore_fail_integrity_with_matching_checksum', rr4.status === 1 && fs.readdirSync(cleanRoot).length === 0, rr4.stderr.trim().slice(0, 120) + ' left=' + fs.readdirSync(cleanRoot).join());
  // 4i path traversal / absolute / symlink in manifest + backup tree
  const trav = (name, mut) => { const d = mk(name); const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8')); mut(m, d); fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(m)); return spawnSync(process.execPath, [RESTORE, d, path.join(cleanRoot, 'r-' + name)], { encoding: 'utf8' }); };
  fs.writeFileSync(path.join(TMP, 'outside.txt'), 'outside-secret');
  const outsideHash = sha(path.join(TMP, 'outside.txt'));
  let x = trav('trav1', m => { m.uploads[0].path = '../../outside.txt'; m.uploads[0].sha256 = outsideHash; });
  check('traversal.upload_dotdot_rejected', x.status === 1 && /unsafe manifest path/.test(x.stderr), x.stderr.trim());
  x = trav('trav2', m => { m.uploads[0].path = path.join(TMP, 'outside.txt'); m.uploads[0].sha256 = outsideHash; });
  check('traversal.upload_absolute_rejected', x.status === 1 && /unsafe/.test(x.stderr), x.stderr.trim());
  x = trav('trav3', m => { m.uploads[0].path = 'a\\..\\..\\outside.txt'; });
  check('traversal.upload_backslash_dotdot_rejected', x.status === 1, x.stderr.trim());
  x = trav('trav4', m => { m.database.path = '../outside.txt'; m.database.sha256 = outsideHash; });
  check('traversal.database_path_rejected', x.status === 1 && /unsafe/.test(x.stderr), x.stderr.trim());
  x = trav('trav5', m => { m.source_db_basename = '../evil.db'; });
  check('traversal.db_basename_rejected', x.status === 1 && /invalid backup manifest/.test(x.stderr), x.stderr.trim());
  x = trav('trav6', m => { m.source_db_basename = '..'; });
  check('traversal.db_basename_dotdot_rejected', x.status === 1, x.stderr.trim());
  x = trav('sym1', (m, d) => { const f = path.join(d, 'uploads', m.uploads[0].path); const content = fs.readFileSync(f); fs.rmSync(f); fs.writeFileSync(path.join(TMP, 'real-target'), content); fs.symlinkSync(path.join(TMP, 'real-target'), f); });
  check('traversal.symlinked_upload_file_rejected', x.status === 1 && /symlink/.test(x.stderr), x.stderr.trim());
  x = trav('sym2', (m, d) => { const f = path.join(d, 'uploads'); const alt = path.join(TMP, 'alt-uploads'); fs.renameSync(f, alt); fs.symlinkSync(alt, f); });
  check('traversal.symlinked_uploads_dir_rejected', x.status === 1, 'status=' + x.status + ' ' + (x.stderr || x.stdout).trim().slice(0, 160));
  check('traversal.nothing_left_after_rejections', leftovers(cleanRoot).length === 0 && fs.readdirSync(cleanRoot).length === 0, fs.readdirSync(cleanRoot).join());
  // 4j backup destination inside upload dir / data dir contamination
  const inUp = path.join(upDir, 'nested-backup');
  const bn = spawnSync(process.execPath, [BACKUP, inUp], { env: { PATH: process.env.PATH, DB_PATH: dbFile, UPLOAD_DIR: upDir }, encoding: 'utf8' });
  const contaminated = fs.existsSync(inUp);
  check('pathval.backup_dest_inside_upload_dir_rejected', bn.status === 1 && !contaminated, 'status=' + bn.status + ' dest_created_inside_uploads=' + contaminated + ' ' + (bn.stderr || bn.stdout).trim().slice(0, 150));
  if (contaminated) fs.rmSync(inUp, { recursive: true, force: true });
  // 4k UPLOAD_DIR containing the DB
  const bu = spawnSync(process.execPath, [BACKUP, path.join(TMP, 'bk', 'upload-contains-db')], { env: { PATH: process.env.PATH, DB_PATH: dbFile, UPLOAD_DIR: data }, encoding: 'utf8' });
  check('pathval.backup_rejects_upload_dir_containing_db', bu.status === 1, 'status=' + bu.status + ' ' + (bu.stderr || bu.stdout).trim().slice(0, 150));
  fs.rmSync(path.join(TMP, 'bk', 'upload-contains-db'), { recursive: true, force: true });
  // ---------- 5. Shutdown ----------
  for (const sig of ['SIGTERM', 'SIGINT']) {
    const sd = path.join(TMP, 'sd-' + sig); fs.mkdirSync(sd, { mode: 0o755 });
    const s = await startServer({ KHERJA_DEV: '1', PORT: '0', HOST: '127.0.0.1', DB_PATH: path.join(sd, 'k.db'), UPLOAD_DIR: path.join(sd, 'up') });
    const agent = new http.Agent({ keepAlive: true }); await req(s.port, 'POST', '/api/waitlist', { phone: '0555001234', name: 'a', email: 'a@example.com', role: 'rider' }, {}, agent); await req(s.port, 'GET', '/api/health', undefined, {}, agent);
    const t0 = Date.now(); s.child.kill(sig); const ex = await exitOf(s); const dt = Date.now() - t0;
    check('shutdown.' + sig + '_clean_exit0_within_10s_with_idle_keepalive', ex.code === 0 && dt < 10000, JSON.stringify(ex) + ' ms=' + dt);
    check('shutdown.' + sig + '_logged', new RegExp('received ' + sig).test(s.out()), s.out().trim());
    const refused = await new Promise(res => { const c = http.get({ host: '127.0.0.1', port: s.port, path: '/api/health' }, () => res(false)); c.on('error', () => res(true)); });
    check('shutdown.' + sig + '_port_closed', refused);
    agent.destroy();
    const dbc = new DatabaseSync(path.join(sd, 'k.db'), { readOnly: true }); const n = dbc.prepare('select count(*) n from waitlist').get().n; const ic = dbc.prepare('pragma integrity_check').get().integrity_check; dbc.close();
    check('shutdown.' + sig + '_db_intact_and_committed', n === 1 && ic === 'ok', 'rows=' + n + ' integrity=' + ic);
    check('shutdown.' + sig + '_wal_checkpointed', !fs.existsSync(path.join(sd, 'k.db-wal')) || fs.statSync(path.join(sd, 'k.db-wal')).size === 0, fs.readdirSync(sd).join());
  }
  // in-flight slow request is allowed to finish
  {
    const sd = path.join(TMP, 'sd-inflight'); fs.mkdirSync(sd);
    const s = await startServer({ KHERJA_DEV: '1', PORT: '0', HOST: '127.0.0.1', DB_PATH: path.join(sd, 'k.db'), UPLOAD_DIR: path.join(sd, 'up') });
    // open a raw socket, send partial request, then SIGTERM, then complete it
    const net = require('node:net'); const sock = net.connect(s.port, '127.0.0.1'); let resp = ''; sock.on('data', d => resp += d);
    const body = JSON.stringify({ phone: '0555001299', name: 'b', email: 'b@example.com', role: 'rider' });
    sock.write(`POST /api/waitlist HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\n\r\n`);
    await sleep(200); s.child.kill('SIGTERM'); await sleep(300); sock.write(body);
    const ex = await exitOf(s); sock.destroy();
    check('shutdown.inflight_request_completes_before_exit', /HTTP\/1.1 200/.test(resp) && ex.code === 0, JSON.stringify(ex) + ' resp=' + resp.slice(0, 40).replace(/\r?\n/g, ' '));
  }
  // stuck connection: force timeout (exit code 1 within ~10s)
  {
    const sd = path.join(TMP, 'sd-stuck'); fs.mkdirSync(sd);
    const s = await startServer({ KHERJA_DEV: '1', PORT: '0', HOST: '127.0.0.1', DB_PATH: path.join(sd, 'k.db'), UPLOAD_DIR: path.join(sd, 'up') });
    const net = require('node:net'); const sock = net.connect(s.port, '127.0.0.1'); sock.on('error', () => {});
    sock.write('POST /api/waitlist HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: 100\r\n\r\n{'); await sleep(200);
    const t0 = Date.now(); s.child.kill('SIGTERM'); const ex = await exitOf(s, 20000); const dt = Date.now() - t0; sock.destroy();
    console.log('STUCK_CONNECTION', JSON.stringify(ex), 'ms=' + dt, 'err=' + s.err().trim().slice(-120));
    check('shutdown.stuck_connection_bounded_by_force_timeout', !ex.timeout && dt < 12000, JSON.stringify(ex) + ' ms=' + dt);
  }
  // ---------- 6. Health ----------
  const h = await req(srv.port, 'GET', '/api/health');
  check('health.ok_body_minimal', h.status === 200 && JSON.stringify(h.json) === '{"ok":true,"db":"ok"}', h.text);
  const { createApp } = require(path.join(ROOT, 'backend/server.js'));
  const app = createApp({ dbPath: path.join(TMP, 'health.db'), uploadDir: path.join(TMP, 'health-up'), dev: true, devAdmin: true }); await new Promise(r => app.listen(0, '127.0.0.1', r));
  const hp = app.address().port; const origErr = console.error; let logged = []; console.error = (...a) => logged.push(a.join(' '));
  app.db.close();
  const hf = await req(hp, 'GET', '/api/health'); console.error = origErr;
  check('health.detects_db_failure_non2xx', hf.status >= 500, 'status=' + hf.status + ' body=' + hf.text);
  check('health.failure_body_no_disclosure', !/health\.db|\/tmp|stack|sqlite|node:|\n\s+at |database is not open/i.test(hf.text), hf.text);
  check('health.failure_body_not_ok_true', !(hf.json && hf.json.ok === true));
  check('health.no_extra_headers_leak', !('x-powered-by' in h.headers) && !('server' in h.headers), JSON.stringify(Object.keys(h.headers)));
  await new Promise(r => app.close(r));
  // ---------- 7. Trusted proxy ----------
  const proxyRun = async (envExtra, fn) => { const pd = path.join(TMP, 'px-' + crypto.randomBytes(3).toString('hex')); fs.mkdirSync(pd); const s = await startServer({ KHERJA_DEV: '1', PORT: '0', HOST: '127.0.0.1', DB_PATH: path.join(pd, 'k.db'), UPLOAD_DIR: path.join(pd, 'up'), ...envExtra }); try { return await fn(s.port); } finally { s.child.kill('SIGTERM'); await exitOf(s); } };
  const otp = (port, i, xff) => req(port, 'POST', '/api/auth/otp', { phone: '0555' + String(1000000 + i).slice(1) }, xff ? { 'X-Forwarded-For': xff } : {});
  let st = await proxyRun({}, async port => { const o = []; for (let i = 0; i < 22; i++) o.push((await otp(port, i, `203.0.113.${i + 1}`)).status); return o; });
  check('proxy.untrusted_peer_spoofed_xff_ignored', st.slice(0, 20).every(s => s === 200) && st[20] === 429, st.join(','));
  st = await proxyRun({ TRUSTED_PROXY_IPS: '127.0.0.1' }, async port => { const o = []; for (let i = 0; i < 22; i++) o.push((await otp(port, i, `203.0.113.${i + 1}`)).status); return o; });
  check('proxy.trusted_peer_uses_xff_buckets', st.every(s => s === 200), st.join(','));
  st = await proxyRun({ TRUSTED_PROXY_IPS: '127.0.0.1' }, async port => { const o = []; for (let i = 0; i < 22; i++) o.push((await otp(port, i, '203.0.113.50')).status); return o; });
  check('proxy.trusted_peer_same_client_still_limited', st.slice(0, 20).every(s => s === 200) && st[20] === 429, st.join(','));
  st = await proxyRun({ TRUSTED_PROXY_IPS: '127.0.0.1' }, async port => { const o = []; for (let i = 0; i < 22; i++) o.push((await otp(port, i, `198.18.${i}.1, 203.0.113.50`)).status); return o; });
  check('proxy.client_prepended_xff_entries_ignored_uses_last_hop', st.slice(0, 20).every(s => s === 200) && st[20] === 429, st.join(','));
  st = await proxyRun({ TRUSTED_PROXY_IPS: '127.0.0.1' }, async port => { const o = []; for (let i = 0; i < 22; i++) o.push((await otp(port, i, i % 2 ? 'garbage' : '')).status); return o; });
  check('proxy.malformed_or_empty_xff_falls_back_to_peer', st[20] === 429 || st[21] === 429, st.join(','));
  st = await proxyRun({ TRUSTED_PROXY_IPS: '::1' }, async port => { const o = []; for (let i = 0; i < 22; i++) o.push((await otp(port, i, `203.0.113.${i + 1}`)).status); return o; });
  check('proxy.allowlist_other_ip_does_not_trust_ipv4_loopback_peer', st[20] === 429, st.join(','));
  st = await proxyRun({ TRUSTED_PROXY_IPS: '10.0.0.0/8' }, async () => 0).catch(e => 'ERR');
  check('proxy.cidr_rejected_at_startup', st === 0 ? false : true, String(st));
  // ---------- 8. Config rejection ----------
  const cfgCases = [
    ['PORT=abc', { PORT: 'abc' }, /invalid PORT/], ['PORT=65536', { PORT: '65536' }, /invalid PORT/], ['PORT=-1', { PORT: '-1' }, /invalid PORT/], ['PORT=1.5', { PORT: '1.5' }, /invalid PORT/], ['PORT=08080', { PORT: '08080' }, /invalid PORT/], ['PORT=0x50', { PORT: '0x50' }, /invalid PORT/], ['PORT=1e3', { PORT: '1e3' }, /invalid PORT/],
    ['HOST=bad host', { HOST: 'bad host' }, /invalid HOST/], ['HOST=url', { HOST: 'http://localhost' }, /invalid HOST/], ['HOST=underscore', { HOST: 'bad_host' }, /invalid HOST/], ['HOST=shell', { HOST: '127.0.0.1;rm -rf /' }, /invalid HOST/], ['HOST=999.999.999.999', { HOST: '999.999.999.999' }, /invalid HOST/],
    ['ADMIN_PHONE only', { ADMIN_PHONE: '0555123456' }, /provided together/], ['ADMIN_PASSWORD only', { ADMIN_PASSWORD: 'X'.repeat(20) }, /provided together/], ['ADMIN_PHONE bad', { ADMIN_PHONE: '12', ADMIN_PASSWORD: 'Y'.repeat(20) }, /invalid ADMIN_PHONE/], ['ADMIN_PASSWORD short', { ADMIN_PHONE: '0555123456', ADMIN_PASSWORD: 'Zz9-short' }, /at least 16/],
    ['TRUSTED_PROXY_IPS cidr', { TRUSTED_PROXY_IPS: '10.0.0.0/8' }, /invalid TRUSTED_PROXY_IPS/], ['SQLITE_BUSY_TIMEOUT_MS=-1', { SQLITE_BUSY_TIMEOUT_MS: '-1' }, /invalid SQLITE_BUSY_TIMEOUT_MS/], ['SQLITE_BUSY_TIMEOUT_MS=60001', { SQLITE_BUSY_TIMEOUT_MS: '60001' }, /invalid SQLITE_BUSY_TIMEOUT_MS/],
  ];
  for (const [name, env, re] of cfgCases) {
    const d = path.join(TMP, 'cfg-' + crypto.randomBytes(3).toString('hex')); const dbp = path.join(d, 'k.db');
    const r = spawnSync(process.execPath, [SERVER], { env: { PATH: process.env.PATH, NODE_ENV: 'production', DB_PATH: dbp, UPLOAD_DIR: path.join(d, 'up'), HOST: '127.0.0.1', PORT: '0', ...env }, encoding: 'utf8', timeout: 15000 });
    const all = r.stdout + r.stderr; const secrets = ['X'.repeat(20), 'Y'.repeat(20), 'Zz9-short'];
    check('config.reject.' + name, r.status === 1 && re.test(r.stderr) && !fs.existsSync(d) && !/kherja api on/.test(r.stdout) && !secrets.some(s => all.includes(s)) && !/\n\s+at /.test(r.stderr), 'status=' + r.status + ' db_dir_created=' + fs.existsSync(d) + ' err=' + r.stderr.trim().split('\n')[0].slice(0, 140));
  }
  const dd = path.join(TMP, 'cfg-devhost'); let rd = spawnSync(process.execPath, [SERVER], { env: { PATH: process.env.PATH, KHERJA_DEV: '1', HOST: '0.0.0.0', PORT: '0', DB_PATH: path.join(dd, 'k.db') }, encoding: 'utf8', timeout: 15000 });
  check('config.reject.dev_mode_non_loopback_host', rd.status === 1 && /loopback/.test(rd.stderr) && !fs.existsSync(dd), rd.stderr.trim());
  const dup = path.join(TMP, 'cfg-upinside'); rd = spawnSync(process.execPath, [SERVER], { env: { PATH: process.env.PATH, NODE_ENV: 'production', HOST: '127.0.0.1', PORT: '0', DB_PATH: path.join(dup, 'k.db'), UPLOAD_DIR: dup }, encoding: 'utf8', timeout: 4000, killSignal: 'SIGKILL' });
  check('config.reject.upload_dir_containing_db', rd.status === 1 && !/kherja api on/.test(rd.stdout), 'status=' + rd.status + ' out=' + rd.stdout.trim().slice(0, 100) + ' err=' + rd.stderr.trim().split('\n')[0].slice(0, 120));
  // ---------- finish ----------
  srv.child.kill('SIGTERM'); await exitOf(srv);
  const failed = results.filter(r => !r.ok);
  console.log('\nSUMMARY total=' + results.length + ' pass=' + (results.length - failed.length) + ' fail=' + failed.length);
  for (const f of failed) console.log('  FAILED: ' + f.id + ' :: ' + f.detail);
  fs.writeFileSync(process.env.OPSVAL_OUT || path.join(os.tmpdir(), 'opsval-result.json'), JSON.stringify({ node: process.version, sqlite: process.versions.sqlite, results }, null, 1));
  fs.rmSync(TMP, { recursive: true, force: true });
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); try { fs.rmSync(TMP, { recursive: true, force: true }); } catch {} process.exit(2); });
