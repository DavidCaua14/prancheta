-- =====================================================================
-- Prancheta — estrutura do clube (estádio, lanchonete, loja oficial)
--
-- O técnico investe moedas para subir cada estrutura (nível 0 a 5). Cada
-- uma rende moedas por JOGO DA LIGA COMO MANDANTE (copa é campo neutro e
-- amistoso não vale — nada para combinar com amigo). No nível 0 não rende:
-- é preciso investir antes. Espelho: lib/club/facilities.ts.
--
--   0 Estádio (bilheteria): cresce com a divisão (público maior)
--   1 Lanchonete: renda fixa, barata
--   2 Loja oficial: mais cara, é a que mais cresce com a divisão (marca)
--
-- A renda é conferida no servidor pela tabela de jogos (league_home_slots,
-- espelho de doubleRoundRobin) e paga uma vez por jogo (home_income).
-- =====================================================================

alter table public.clubs add column if not exists facilities smallint[] not null default '{0,0,0}';
alter table public.clubs drop constraint if exists clubs_facilities_check;
alter table public.clubs add constraint clubs_facilities_check
  check (cardinality(facilities) = 3 and 0 <= all (facilities) and 5 >= all (facilities));

-- custo para ir do nível n-1 ao n (índice = n)
create or replace function public.facility_cost(p_kind smallint, p_level smallint) returns integer
language sql immutable as $$
  select case p_kind
    when 0 then (array[400, 900, 1500, 2300, 3300])[p_level]
    when 1 then (array[200, 450, 750, 1100, 1600])[p_level]
    else (array[350, 750, 1300, 2000, 3000])[p_level]
  end
$$;

-- renda por jogo em casa no nível, na divisão (0 = Várzea ... 5 = Lendas)
create or replace function public.facility_income(p_kind smallint, p_level smallint, p_division smallint) returns integer
language sql immutable as $$
  select case p_kind
    when 0 then round((array[0, 8, 16, 24, 32, 40])[p_level + 1] * (1 + 0.1 * least(p_division, 5)))::int
    when 1 then (array[0, 4, 8, 12, 16, 20])[p_level + 1]
    else round((array[0, 5, 10, 15, 20, 25])[p_level + 1] * (1 + 0.2 * least(p_division, 5)))::int
  end
$$;

-- vagas que jogam em casa numa rodada (espelho de doubleRoundRobin em lib/league/schedule.ts)
create or replace function public.league_home_slots(p_size int, p_round int) returns int[]
language plpgsql immutable as $$
declare
  slots int[];
  r int;
  i int;
  res int[] := '{}';
  leg int := (p_round - 1) / (p_size - 1);
  rr int := (p_round - 1) % (p_size - 1);
  a int;
  b int;
begin
  slots := array(select generate_series(0, p_size - 1));
  for r in 1..rr loop
    slots := array[slots[1], slots[p_size]] || slots[2:p_size - 1];
  end loop;
  for i in 0..p_size / 2 - 1 loop
    a := slots[i + 1];
    b := slots[p_size - i];
    if ((rr + i) % 2 = 0) = (leg = 0) then res := res || a; else res := res || b; end if;
  end loop;
  return res;
end $$;

create table if not exists public.home_income (
  club_id   uuid not null references public.clubs (id) on delete cascade,
  league_id bigint not null references public.leagues (id) on delete cascade,
  round     smallint not null,
  stadium   integer not null default 0,
  snack     integer not null default 0,
  shop      integer not null default 0,
  coins     integer not null,
  paid_at   timestamptz not null default now(),
  primary key (club_id, league_id, round)
);
create index if not exists home_income_recent on public.home_income (club_id, paid_at desc);
alter table public.home_income enable row level security;
drop policy if exists "home_income: o meu" on public.home_income;
create policy "home_income: o meu" on public.home_income for select to authenticated using (club_id = (select auth.uid()));
revoke all on public.home_income from anon, authenticated;
grant select on public.home_income to authenticated;

/* ------------------------------------------------- receber a renda */

-- Paga os jogos em casa já encerrados (10 min depois do apito) ainda não pagos
-- de um clube numa liga. Usada pela RPC e pelo gatilho de troca de liga.
create or replace function public.pay_home_income(p_club uuid, p_league bigint, p_slot smallint, p_joined smallint, p_fac smallint[])
returns integer
language plpgsql security definer set search_path = public as $$
declare
  lg public.leagues;
  total int := 0;
begin
  if p_league is null or p_slot is null then return 0; end if;
  select * into lg from public.leagues where id = p_league;
  if not found then return 0; end if;
  with due as (
    select r.round,
           public.facility_income(0::smallint, p_fac[1], lg.division) as stadium,
           public.facility_income(1::smallint, p_fac[2], lg.division) as snack,
           public.facility_income(2::smallint, p_fac[3], lg.division) as shop
      from public.league_rounds r
     where r.league_id = p_league
       and r.round >= coalesce(p_joined, 1)
       and r.kickoff + interval '10 minutes' <= now()
       and p_slot = any (public.league_home_slots(lg.size, r.round))
  ), ins as (
    insert into public.home_income (club_id, league_id, round, stadium, snack, shop, coins)
    select p_club, p_league, d.round, d.stadium, d.snack, d.shop, d.stadium + d.snack + d.shop
      from due d
    -- jogo com tudo no nível 0 também fica marcado (rende 0): investir depois não paga jogo antigo
    on conflict do nothing
    returning coins
  )
  select coalesce(sum(coins), 0) into total from ins;
  return total;
end $$;
revoke all on function public.pay_home_income(uuid, bigint, smallint, smallint, smallint[]) from public, anon, authenticated;

-- RPC do aparelho: recebe o que estiver pendente na liga atual
create or replace function public.collect_home_income() returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  c public.clubs;
  total int;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  select * into c from public.clubs where id = uid for update;
  if not found then return 0; end if;
  total := public.pay_home_income(uid, c.league_id, c.league_slot, c.joined_round, c.facilities);
  if total > 0 then update public.clubs set coins = coins + total where id = uid; end if;
  return total;
end $$;
revoke all on function public.collect_home_income() from public, anon;
grant execute on function public.collect_home_income() to authenticated;

-- Troca de liga (fim de temporada): paga o que ficou pendente na liga antiga
create or replace function public.pay_home_income_on_move() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  total int;
begin
  if old.league_id is not null and new.league_id is distinct from old.league_id then
    total := public.pay_home_income(old.id, old.league_id, old.league_slot, old.joined_round, old.facilities);
    new.coins := new.coins + total;
  end if;
  return new;
end $$;
drop trigger if exists clubs_pay_home_income on public.clubs;
create trigger clubs_pay_home_income before update of league_id on public.clubs
  for each row execute function public.pay_home_income_on_move();

/* ----------------------------------------------------------- melhorar */

create or replace function public.upgrade_facility(p_kind smallint) returns smallint[]
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  cur smallint;
  cost int;
  c public.clubs;
  got int;
  out smallint[];
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if p_kind not between 0 and 2 then raise exception 'estrutura inválida' using errcode = '22023'; end if;
  select facilities[p_kind + 1] into cur from public.clubs where id = uid for update;
  if not found then raise exception 'clube não encontrado' using errcode = 'P0002'; end if;
  if cur >= 5 then raise exception 'nível máximo' using errcode = 'P0017'; end if;
  -- antes de subir: recebe os jogos em casa já encerrados no nível antigo
  select * into c from public.clubs where id = uid;
  got := public.pay_home_income(uid, c.league_id, c.league_slot, c.joined_round, c.facilities);
  cost := public.facility_cost(p_kind, (cur + 1)::smallint);
  update public.clubs
     set coins = coins + got - cost, facilities[p_kind + 1] = cur + 1
   where id = uid and coins + got >= cost
   returning facilities into out;
  if not found then
    -- sem moedas para subir: ao menos credita o que recebeu
    if got > 0 then update public.clubs set coins = coins + got where id = uid; end if;
    return null;
  end if;
  return out;
end $$;
revoke all on function public.upgrade_facility(smallint) from public, anon;
grant execute on function public.upgrade_facility(smallint) to authenticated;

