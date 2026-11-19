-- SQLite flavour of ../schema.sql (Postgres/PostGIS is the production target)
create table if not exists users(
  id integer primary key, phone text not null unique, name text, role text not null default 'rider' check(role in('rider','driver','admin')),
  lang text not null default 'ar', city text, prefers_women integer not null default 0, created_at text not null default (datetime('now')));
create table if not exists otps(phone text primary key, code_hash text not null, expires_at integer not null, tries integer not null default 0);
create table if not exists sessions(token_hash text primary key, user_id integer not null references users(id) on delete cascade, expires_at integer not null);
create table if not exists drivers(user_id integer primary key references users(id) on delete cascade, car text not null, plate text not null unique,
  online integer not null default 0, lat real, lng real, is_woman integer not null default 0, docs_status text not null default 'pending');
create table if not exists requests(
  id integer primary key, rider_id integer not null references users(id) on delete cascade,
  p_lat real not null, p_lng real not null, p_label text not null, d_lat real not null, d_lng real not null, d_label text not null,
  price integer not null check(price>0), note text, women_only integer not null default 0,
  kind text not null default 'ride' check(kind in('ride','delivery')), item_type text check(item_type in('food','parcel')), item_note text, recipient_name text, recipient_phone text,
  status text not null default 'open' check(status in('open','matched','cancelled','expired')),
  expires_at integer not null, created_at text not null default (datetime('now')));
create index if not exists idx_req_rider on requests(rider_id);
create index if not exists idx_req_status on requests(status, expires_at);
create table if not exists offers(
  id integer primary key, request_id integer not null references requests(id) on delete cascade,
  driver_id integer not null references drivers(user_id) on delete cascade, price integer not null check(price>0), eta_min integer not null check(eta_min>=0),
  status text not null default 'pending' check(status in('pending','accepted','declined','expired')), created_at text not null default (datetime('now')),
  unique(request_id, driver_id));
create index if not exists idx_off_req on offers(request_id);
create table if not exists rides(
  id integer primary key, request_id integer not null unique references requests(id), offer_id integer not null unique references offers(id),
  rider_id integer not null references users(id), driver_id integer not null references drivers(user_id),
  status text not null default 'en_route' check(status in('en_route','arrived','in_progress','completed','cancelled')),
  locked_price integer not null, created_at text not null default (datetime('now')));
create unique index if not exists one_active_ride_per_driver on rides(driver_id) where status in('en_route','arrived','in_progress');
create index if not exists idx_ride_rider on rides(rider_id);
create trigger if not exists lock_price before update of locked_price on rides begin select raise(abort,'locked_price is immutable'); end;
create table if not exists ratings(id integer primary key, ride_id integer not null references rides(id) on delete cascade,
  from_user integer not null references users(id), to_user integer not null references users(id), stars integer not null check(stars between 1 and 5), tags text not null default '[]',
  unique(ride_id, from_user));
create table if not exists safety_contacts(id integer primary key, user_id integer not null references users(id) on delete cascade, name text not null, phone text not null);
create index if not exists idx_sc_user on safety_contacts(user_id);
create table if not exists reports(id integer primary key, ride_id integer not null references rides(id) on delete cascade, reporter_id integer not null references users(id),
  kind text not null check(kind in('price_dispute','safety','other')), body text, status text not null default 'open', created_at text not null default (datetime('now')));
create table if not exists waitlist(id integer primary key, phone text not null unique, role text not null check(role in('rider','driver')), city text, created_at text not null default (datetime('now')));
