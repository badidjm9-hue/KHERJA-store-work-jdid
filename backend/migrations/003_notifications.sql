-- In-app notifications: rows are written only by real server events (no push/SMS provider is involved).
create table if not exists notifications(
  id integer primary key, user_id integer not null references users(id) on delete cascade,
  kind text not null check(kind in('new_offer','offer_accepted','ride_status','report_status')),
  ref_id integer, detail text, created_at text not null default (datetime('now')), read_at text);
create index if not exists idx_notif_user on notifications(user_id, id);
