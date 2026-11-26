-- =====================================================================
-- Prancheta — tela do leilão: tudo num pedido só
--
-- Antes, ao abrir: clube (moedas) → lotes + meus lances → nomes de quem lidera,
-- em 3 etapas; e a cada 8 s, 2–3 consultas. Agora auction_bundle devolve os
-- lotes da rodada atual e da anterior (e os ainda em disputa), os meus lances,
-- quem lidera (nome/escudo) e as minhas moedas, de uma vez.
-- security invoker: valem as regras de leitura (RLS) de cada tabela.
-- =====================================================================

create or replace function public.auction_bundle(p_round int) returns jsonb
language sql stable security invoker set search_path = public as $$
  with lots as (
    select a.round, a.idx, a.best_club, a.best_amount, a.bids, a.ends_at
      from public.auction_lots a
     where a.round in (p_round, p_round - 1) or a.ends_at > now() or a.best_club = auth.uid()
  )
  select jsonb_build_object(
    'coins',   (select c.coins from public.clubs c where c.id = auth.uid()),
    'lots',    coalesce((select jsonb_agg(to_jsonb(l) order by l.ends_at desc) from lots l), '[]'::jsonb),
    'bidders', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'tag', c.tag, 'crest', c.crest))
                           from public.clubs c where c.id in (select best_club from lots where best_club is not null)), '[]'::jsonb)
  )
$$;
revoke all on function public.auction_bundle(int) from public, anon;
grant execute on function public.auction_bundle(int) to authenticated;
