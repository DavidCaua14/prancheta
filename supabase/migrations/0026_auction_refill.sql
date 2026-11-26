-- =====================================================================
-- Prancheta — leilão: carta arrematada é reposta na hora
--
-- Antes, a vaga ficava "Encerrado" até a rodada seguinte (até 2 h). Agora,
-- quando um lote é arrematado antes do fim da rodada, a vaga recebe a carta
-- seguinte (mesma raridade). Índice = vaga + 12 × geração (vaga 3: 3, 15,
-- 27...), até 20 gerações por vaga. A geração g só aceita lance se a g-1 foi
-- arrematada (tem lance e já fechou) antes do fim da rodada.
-- Espelho: lotTier / currentLotIdx em lib/auction/lots.ts.
-- =====================================================================

alter table public.auction_lots drop constraint if exists auction_lots_idx_check;
alter table public.auction_lots add constraint auction_lots_idx_check check (idx between 0 and 239);

create or replace function public.auction_tier(p_round int, p_idx int) returns smallint
language sql immutable as $$
  select (case when p_idx % 12 >= 8 then 0 when p_idx % 12 <= 4 then 1 when p_idx % 12 <= 6 then 2
               when p_round % 4 = 0 then 3 else 1 end)::smallint
$$;

create or replace function public.place_bid(p_round int, p_idx smallint, p_amount int)
returns public.auction_lots
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  lot public.auction_lots;
  prev public.auction_lots;
  start_at timestamptz := to_timestamp(p_round::double precision * 7200);
  need int;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if p_idx not between 0 and 239 then raise exception 'lote inválido' using errcode = '22023'; end if;
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
    -- reposição: só abre depois que a carta anterior da vaga foi arrematada, dentro da rodada
    if p_idx >= 12 then
      select * into prev from public.auction_lots where round = p_round and idx = p_idx - 12;
      if not found or prev.ends_at > now() or prev.ends_at >= start_at + interval '2 hours' then
        raise exception 'lote ainda não abriu' using errcode = 'P0004';
      end if;
    end if;
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
