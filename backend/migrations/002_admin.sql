create table if not exists driver_docs(
  id integer primary key, user_id integer not null references users(id) on delete cascade,
  kind text not null check(kind in('vehicle_photo','license','registration','insurance')),
  mime text not null, file text not null, size integer not null, expires_on text,
  status text not null default 'pending' check(status in('pending','approved','rejected')), reason text,
  reviewed_by integer references users(id), reviewed_at text, created_at text not null default (datetime('now')));
create index if not exists idx_docs_user on driver_docs(user_id);
create table if not exists audit(id integer primary key, admin_id integer not null, action text not null, target text not null, detail text, created_at text not null default (datetime('now')));
