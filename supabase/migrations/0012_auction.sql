-- =====================================================================
-- Prancheta — Leilão
--
-- A cada 2 h abre uma rodada com 8 lotes (rodada = floor(epoch / 7200)).
-- A carta de cada lote é gerada no aparelho a partir de (rodada, índice);
-- o banco guarda só o MAIOR LANCE de cada lote que recebeu lance.
-- O lote arrematado (ends_at no passado) é do clube que deu o maior lance:
-- não existe "entrega" — o elenco é montado no aparelho a partir daqui.
--
-- Moedas: ficam travadas no lance (saem de clubs.coins na hora) e voltam
-- para quem foi superado. Entram 1.000 no começo e um prêmio por posição
-- no fim de cada temporada (close_league).
-- Espelho das regras: lib/auction/lots.ts
-- =====================================================================

alter table public.clubs add column if not exists coins integer not null default 1000 check (coins >= 0);

-- elenco pode crescer: 14 da peneira + até 10 do leilão (índices 0..23 = 0-9, a-n)
alter table public.clubs drop constraint if exists clubs_xp_check;
alter table public.clubs add constraint clubs_xp_check
  check (xp is null or (cardinality(xp) between 14 and 24 and 0 <= all (xp)));

create or replace function public.lineup_ok(l text) returns boolean
language sql immutable as $$
  select l ~ '^1:[0-9a-d]:[0-9a-n]{11}:[0-4][0-2][0-2]:[0-9a-n]{2}$'
     and (select count(distinct c) from regexp_split_to_table(split_part(l, ':', 3), '') as c) = 11
     and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 1, 1)) > 0
     and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 2, 1)) > 0
$$;

create table if not exists public.auction_lots (
  round      integer  not null,
  idx        smallint not null check (idx between 0 and 7),
  best_club  uuid references public.clubs (id) on delete set null,
  best_amount integer not null check (best_amount > 0),
  bids       smallint not null default 1,
  ends_at    timestamptz not null,
  primary key (round, idx)
);
create index if not exists auction_lots_club on public.auction_lots (best_club, ends_at);

-- 1 = Destaque, 2 = Épica, 3 = Especial (espelho de lotTier)
create or replace function public.auction_tier(p_round int, p_idx int) returns smallint
language sql immutable as $$
  select (case when p_idx <= 4 then 1 when p_idx <= 6 then 2 when p_round % 4 = 0 then 3 else 1 end)::smallint
$$;

create or replace function public.auction_min(p_tier smallint) returns integer
language sql immutable as $$
  select case p_tier when 1 then 300 when 2 then 900 else 2500 end
$$;

create or replace function public.place_bid(p_round int, p_idx smallint, p_amount int)
returns public.auction_lots
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lot public.auction_lots;
  start_at timestamptz := to_timestamp(p_round::double precision * 7200);
  need int;
  holding int;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if p_idx not between 0 and 7 then raise exception 'lote inválido' using errcode = '22023'; end if;
  if now() < start_at or now() > start_at + interval '4 hours' then
    raise exception 'lote fora do horário' using errcode = 'P0004';
  end if;
  if not exists (select 1 from public.clubs where id = uid and squad is not null) then
    raise exception 'monte o elenco antes' using errcode = 'P0001';
  end if;

  -- um lance por vez em cada lote
  perform pg_advisory_xact_lock(p_round, p_idx);
  select * into lot from public.auction_lots where round = p_round and idx = p_idx;

  if found then
    if now() >= lot.ends_at then raise exception 'lote encerrado' using errcode = 'P0004'; end if;
    if lot.best_club = uid then raise exception 'você já tem o maior lance' using errcode = 'P0005'; end if;
    need := greatest(lot.best_amount + 10, ceil(lot.best_amount * 1.05)::int);
  else
    if now() >= start_at + interval '2 hours' then raise exception 'lote encerrado' using errcode = 'P0004'; end if;
    need := public.auction_min(public.auction_tier(p_round, p_idx));
  end if;
  if p_amount < need then raise exception 'lance mínimo: %', need using errcode = 'P0006'; end if;

  -- cartas extras: arrematadas + liderando agora (máx. 10)
  select count(*) into holding from public.auction_lots where best_club = uid;
  if holding >= 10 then raise exception 'elenco cheio' using errcode = 'P0007'; end if;

  -- trava as moedas de quem deu o lance e devolve as do anterior
  update public.clubs set coins = coins - p_amount where id = uid and coins >= p_amount;
  if not found then raise exception 'moedas insuficientes' using errcode = 'P0008'; end if;

  if lot.round is not null then
    if lot.best_club is not null then
      update public.clubs set coins = coins + lot.best_amount where id = lot.best_club;
    end if;
    update public.auction_lots
       set best_club = uid, best_amount = p_amount, bids = bids + 1,
           ends_at = greatest(ends_at, now() + interval '60 seconds')
     where round = p_round and idx = p_idx
     returning * into lot;
  else
    insert into public.auction_lots (round, idx, best_club, best_amount, ends_at)
    values (p_round, p_idx, uid, p_amount, greatest(start_at + interval '2 hours', now() + interval '60 seconds'))
    returning * into lot;
  end if;
  return lot;
end $$;
revoke all on function public.place_bid(int, smallint, int) from public, anon;
grant execute on function public.place_bid(int, smallint, int) to authenticated;

alter table public.auction_lots enable row level security;
drop policy if exists "auction_lots: leitura" on public.auction_lots;
create policy "auction_lots: leitura" on public.auction_lots for select to authenticated using (true);
revoke all on public.auction_lots from anon, authenticated;
grant select on public.auction_lots to authenticated;
-- coins sem grant de update: só place_bid() e close_league() mexem

/* ------------------------------ fim de temporada: XP (24) + prêmio */

-- prêmio do 1º colocado por divisão; cai até 25% no último (espelho de seasonPrize)
create or replace function public.season_prize(p_division smallint, p_pos smallint, p_size smallint) returns integer
language sql immutable as $$
  select round((array[300, 500, 800, 1200, 1800, 2800])[least(p_division, 5) + 1]
               * (p_size - p_pos + 3)::numeric / (p_size + 2))::int
$$;

alter table public.club_seasons add column if not exists coins integer not null default 0;

create or replace function public.close_league(p_league bigint, p_final text, p_points smallint[], p_xp jsonb default '{}'::jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  lg public.leagues;
  rules record;
  i int;
begin
  select * into lg from public.leagues where id = p_league for update;
  if not found then raise exception 'liga não encontrada' using errcode = 'P0002'; end if;
  if lg.closed_at is not null then return lg.final; end if;
  if lg.ends_at > now() then raise exception 'temporada em andamento' using errcode = 'P0001'; end if;

  if length(p_final) <> lg.size or coalesce(array_length(p_points, 1), 0) <> lg.size then
    raise exception 'resultado inválido' using errcode = '22023';
  end if;
  for i in 0..lg.size - 1 loop
    if position(substr('0123456789abcdefghij', i + 1, 1) in p_final) = 0 then
      raise exception 'resultado inválido' using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(coalesce(p_xp, '{}'::jsonb)) <> 'object' then
    raise exception 'xp inválido' using errcode = '22023';
  end if;

  select * into rules from public.division_rules(lg.division);
  update public.leagues set closed_at = now(), final = p_final where id = p_league;

  insert into public.club_seasons (club_id, league_id, division, pos, pts, move, coins)
  select c.id, lg.id, lg.division, p.pos, p_points[c.league_slot + 1],
         case
           when c.division <> lg.division then 0
           when rules.up > 0 and p.pos <= rules.up then 1
           when rules.down > 0 and p.pos > lg.size - rules.down then -1
           else 0
         end,
         public.season_prize(lg.division, p.pos, lg.size)
    from public.clubs c
    cross join lateral (select position(substr('0123456789abcdefghij', c.league_slot + 1, 1) in p_final)::smallint as pos) p
   where c.league_id = lg.id
  on conflict do nothing;

  -- XP: jogos (limitado a 3000 por carta) + bônus de acesso/título; prêmio em moedas
  update public.clubs c
     set xp = (
       select array_agg(
                least(32000,
                  coalesce(c.xp[k], 0)
                  + least(3000, greatest(0, coalesce((p_xp -> c.id::text ->> (k - 1))::int, 0)))
                  + s.bonus
                )::smallint order by k)
         from generate_series(1, 24) k),
         coins = c.coins + s.coins
    from (select club_id, coins,
                 (case when move > 0 then 40 else 0 end) + (case when pos = 1 then 60 else 0 end) as bonus
            from public.club_seasons where league_id = lg.id) s
   where s.club_id = c.id and c.league_id = lg.id;

  update public.clubs c
     set division = c.division + s.move
    from public.club_seasons s
   where s.league_id = lg.id and s.club_id = c.id and s.move <> 0 and c.division = lg.division;

  return p_final;
end $$;
revoke all on function public.close_league(bigint, text, smallint[], jsonb) from public, anon, authenticated;
grant execute on function public.close_league(bigint, text, smallint[], jsonb) to service_role;
