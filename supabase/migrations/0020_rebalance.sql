-- =====================================================================
-- Prancheta — reequilíbrio da economia
--
-- Prêmios de liga e copa compram cartas Base boas; Destaque, Épica e
-- Especial pedem paciência (eventos) ou pacote da loja. Espelho de
-- lib/economy.ts, lib/auction/lots.ts e CUP_KINDS.
--   • temporada: 1º lugar 300 (Várzea) … 700 (Lendas), +50% campeão, 25% no último
--   • copas: até 300 (Várzea), 500 (Nacional), 800 (Supercopa)
--   • eventos: ~1.500 por semana
--   • leilão: +4 lotes Base por rodada (índices 8–11, a partir de 100);
--     Destaque 1.500 · Épica 5.000 · Especial 15.000
--   • clube novo começa com 500
-- =====================================================================

alter table public.clubs alter column coins set default 500;

create or replace function public.season_prize(p_division smallint, p_pos smallint, p_size smallint) returns integer
language sql immutable as $$
  select round(b * (p_size - p_pos + 3)::numeric / (p_size + 2))::int + case when p_pos = 1 then round(b / 2.0)::int else 0 end
    from (select (array[300, 350, 400, 500, 600, 700])[least(greatest(p_division, 0), 5) + 1] as b) x
$$;

create or replace function public.cup_prize(p_kind smallint, p_reach smallint) returns integer
language sql immutable as $$
  select case p_kind
    when 1 then (array[0, 20, 40, 80, 150, 300, 500])[least(greatest(p_reach, 0), 6) + 1]
    when 2 then (array[100, 150, 250, 400, 800])[least(greatest(p_reach, 0), 4) + 1]
    else (array[0, 20, 40, 80, 150, 300])[least(greatest(p_reach, 0), 5) + 1]
  end
$$;

/* ------------------------------------------------ leilão: lotes Base */

alter table public.auction_lots drop constraint if exists auction_lots_idx_check;
alter table public.auction_lots add constraint auction_lots_idx_check check (idx between 0 and 11);

-- 0 = Base, 1 = Destaque, 2 = Épica, 3 = Especial (espelho de lotTier)
create or replace function public.auction_tier(p_round int, p_idx int) returns smallint
language sql immutable as $$
  select (case when p_idx >= 8 then 0 when p_idx <= 4 then 1 when p_idx <= 6 then 2 when p_round % 4 = 0 then 3 else 1 end)::smallint
$$;

create or replace function public.auction_min(p_tier smallint) returns integer
language sql immutable as $$
  select case p_tier when 0 then 100 when 1 then 1500 when 2 then 5000 else 15000 end
$$;

create or replace function public.place_bid(p_round int, p_idx smallint, p_amount int)
returns public.auction_lots
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lot public.auction_lots;
  start_at timestamptz := to_timestamp(p_round::double precision * 7200);
  need int;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if p_idx not between 0 and 11 then raise exception 'lote inválido' using errcode = '22023'; end if;
  if now() < start_at then raise exception 'lote fora do horário' using errcode = 'P0004'; end if;
  if not exists (select 1 from public.clubs where id = uid and squad is not null) then
    raise exception 'monte o elenco antes' using errcode = 'P0001';
  end if;

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

  update public.clubs set coins = coins - p_amount where id = uid and coins >= p_amount;
  if not found then raise exception 'moedas insuficientes' using errcode = 'P0008'; end if;

  if lot.round is not null then
    if lot.best_club is not null then
      update public.clubs set coins = coins + lot.best_amount where id = lot.best_club;
    end if;
    update public.auction_lots
       set best_club = uid, best_amount = p_amount, bids = bids + 1,
           ends_at = now() + interval '10 minutes'
     where round = p_round and idx = p_idx
     returning * into lot;
  else
    insert into public.auction_lots (round, idx, best_club, best_amount, ends_at)
    values (p_round, p_idx, uid, p_amount, now() + interval '10 minutes')
    returning * into lot;
  end if;
  return lot;
end $$;
revoke all on function public.place_bid(int, smallint, int) from public, anon;
grant execute on function public.place_bid(int, smallint, int) to authenticated;

/* --------------------------------------------- eventos: ~1.500/semana */

update public.event_templates set missions = '[
   {"metric":"goals","target":15,"reward":100,"label":"Marque 15 gols"},
   {"metric":"goals","target":40,"reward":300,"label":"Marque 40 gols"},
   {"metric":"big_wins","target":3,"reward":250,"label":"Vença 3 jogos por 3 gols de diferença"},
   {"metric":"cups","target":2,"reward":150,"label":"Dispute 2 copas"},
   {"metric":"games","target":30,"reward":300,"label":"Jogue 30 partidas"},
   {"metric":"top4","target":1,"reward":400,"label":"Termine uma temporada no G4"}]' where id = 0;
update public.event_templates set missions = '[
   {"metric":"clean_sheets","target":3,"reward":150,"label":"Termine 3 jogos sem sofrer gol"},
   {"metric":"clean_sheets","target":8,"reward":350,"label":"Termine 8 jogos sem sofrer gol"},
   {"metric":"wins","target":8,"reward":250,"label":"Vença 8 jogos"},
   {"metric":"games","target":25,"reward":250,"label":"Jogue 25 partidas"},
   {"metric":"cup_wins","target":3,"reward":200,"label":"Avance 3 fases em copas"},
   {"metric":"seasons","target":1,"reward":300,"label":"Complete uma temporada"}]' where id = 1;
update public.event_templates set missions = '[
   {"metric":"games","target":20,"reward":150,"label":"Jogue 20 partidas"},
   {"metric":"games","target":45,"reward":400,"label":"Jogue 45 partidas"},
   {"metric":"cups","target":3,"reward":200,"label":"Dispute 3 copas"},
   {"metric":"cup_games","target":6,"reward":200,"label":"Jogue 6 partidas de copa"},
   {"metric":"seasons","target":2,"reward":300,"label":"Complete 2 temporadas"},
   {"metric":"wins","target":10,"reward":250,"label":"Vença 10 jogos"}]' where id = 2;
update public.event_templates set missions = '[
   {"metric":"wins","target":6,"reward":150,"label":"Vença 6 jogos"},
   {"metric":"wins","target":15,"reward":350,"label":"Vença 15 jogos"},
   {"metric":"top4","target":1,"reward":250,"label":"Termine uma temporada no G4"},
   {"metric":"promotions","target":1,"reward":300,"label":"Conquiste um acesso"},
   {"metric":"cup_wins","target":4,"reward":200,"label":"Avance 4 fases em copas"},
   {"metric":"titles","target":1,"reward":250,"label":"Seja campeão de uma temporada"}]' where id = 3;
