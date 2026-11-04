-- Supabase 대시보드의 SQL Editor에 이 내용을 붙여 넣고 실행하세요.
-- 서버만 서비스 키로 접근하므로 행 보안(RLS)을 켜서 브라우저에서 직접 읽고 쓰지 못하게 막습니다.

create table if not exists profiles (
  id text primary key,
  nickname text not null,
  appearance jsonb not null,
  coins integer not null default 0,
  owned_items jsonb not null default '[]',
  equipped jsonb not null default '{}',
  titles jsonb not null default '[]',
  claimed_rewards jsonb not null default '[]'
);

create table if not exists catches (
  id text primary key,
  player_id text not null,
  species_id text not null,
  size real not null,
  caught_at bigint not null,
  map_id text not null
);
create index if not exists catches_player_idx on catches (player_id);

create table if not exists codex (
  player_id text not null,
  species_id text not null,
  first_caught_at bigint not null,
  max_size real not null,
  count integer not null,
  primary key (player_id, species_id)
);

create table if not exists custom_maps (
  player_id text not null,
  id text not null,
  name text not null,
  data jsonb not null,
  primary key (player_id, id)
);

alter table profiles enable row level security;
alter table catches enable row level security;
alter table codex enable row level security;
alter table custom_maps enable row level security;
