create extension if not exists postgis;
create extension if not exists btree_gist;

create table users (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  photo_url text,
  role text not null default 'rider' check (role in ('rider','driver','admin')),
  lang text not null default 'ar' check (lang in ('ar','fr','en')),
  city text,
  prefers_women_drivers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table drivers (
  user_id uuid primary key references users(id) on delete cascade,
  car_make text not null, car_model text not null, plate text not null unique, color text,
  docs_status text not null default 'pending' check (docs_status in ('pending','approved','rejected')),
  online boolean not null default false,
  rating_avg numeric(3,2) not null default 5.00,
  rides_count int not null default 0,
  cancel_count int not null default 0,
  is_woman boolean not null default false,
  location geography(point,4326),
  updated_at timestamptz not null default now()
);
create index on drivers using gist (location) where online;

create table ride_requests (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references users(id) on delete cascade,
  pickup geography(point,4326) not null, pickup_label text not null,
  dropoff geography(point,4326) not null, dropoff_label text not null,
  offered_price_cents int not null check (offered_price_cents > 0),
  currency text not null default 'DZD',
  note text,
  pay_method text not null default 'cash' check (pay_method in ('cash','card')),
  status text not null default 'open' check (status in ('open','matched','cancelled','expired')),
  expires_at timestamptz not null default now() + interval '5 minutes',
  created_at timestamptz not null default now()
);
create index on ride_requests (rider_id, created_at desc);
create index on ride_requests (status, expires_at);

create table offers (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references ride_requests(id) on delete cascade,
  driver_id uuid not null references drivers(user_id) on delete cascade,
  price_cents int not null check (price_cents > 0),
  eta_min int not null check (eta_min >= 0),
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  expires_at timestamptz not null default now() + interval '60 seconds',
  created_at timestamptz not null default now(),
  unique (request_id, driver_id)
);
create index on offers (request_id, status);
create index on offers (driver_id);

create table rides (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references ride_requests(id) on delete restrict,
  offer_id uuid not null unique references offers(id) on delete restrict,
  rider_id uuid not null references users(id),
  driver_id uuid not null references drivers(user_id),
  status text not null default 'en_route' check (status in ('en_route','arrived','in_progress','completed','cancelled')),
  locked_price_cents int not null,         -- immutable after insert
  started_at timestamptz, ended_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_active_ride_per_driver on rides (driver_id)
  where status in ('en_route','arrived','in_progress');
create index on rides (rider_id, created_at desc);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  from_user uuid not null references users(id),
  to_user uuid not null references users(id),
  stars int not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (ride_id, from_user)
);

create table safety_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  name text not null, phone text not null
);
create index on safety_contacts (user_id);

create table reports (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references rides(id) on delete cascade,
  reporter_id uuid not null references users(id),
  kind text not null check (kind in ('price_dispute','safety','other')),
  body text, status text not null default 'open' check (status in ('open','reviewing','closed')),
  created_at timestamptz not null default now()
);
create index on reports (status, created_at);

-- Access rules (RLS): every table enabled; riders see own requests/rides; drivers see requests
-- within radius while online and own offers/rides; ratings readable by participants only.
alter table users enable row level security;
alter table drivers enable row level security;
alter table ride_requests enable row level security;
alter table offers enable row level security;
alter table rides enable row level security;
alter table ratings enable row level security;
alter table safety_contacts enable row level security;
alter table reports enable row level security;
