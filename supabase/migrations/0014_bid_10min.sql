-- =====================================================================
-- Prancheta — leilão: cada lance fecha o lote 10 minutos depois
--
-- Todo lance novo marca o fim do lote para agora + 10 min (se faltava mais,
-- o tempo cai para 10 min; se faltava menos, volta para 10 min). Assim os
-- outros técnicos sempre têm 10 minutos para ver e cobrir. Lote sem lance
-- fecha no fim da rodada de 2 h. Uma disputa pode passar do fim da rodada:
-- o lote continua aberto enquanto houver lances a menos de 10 min um do outro.
-- Espelho: BID_WINDOW_SECONDS em lib/auction/lots.ts
-- =====================================================================
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
  if p_idx not between 0 and 7 then raise exception 'lote inválido' using errcode = '22023'; end if;
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

-- lotes ainda em disputa (para a tela achar disputas de rodadas anteriores)
create index if not exists auction_lots_open on public.auction_lots (ends_at);
