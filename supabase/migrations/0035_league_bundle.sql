-- =====================================================================
-- Prancheta — tela da liga: tudo num pedido só
--
-- Antes: 3 etapas em sequência (liga/rodadas/clubes/mudanças → escalações →
-- cartas do leilão), cada uma pagando a latência da internet do celular.
-- Agora league_bundle devolve o mesmo conteúdo de uma vez. security invoker:
-- valem as mesmas regras de leitura (RLS) de cada tabela.
-- =====================================================================

create or replace function public.league_bundle(p_league bigint) returns jsonb
language sql stable security invoker set search_path = public as $$
  with lg as (
    select id, division, size, rounds, starts_at, ends_at, closed_at, final from public.leagues where id = p_league
  ), cl as (
    select id, name, tag, crest, kit, squad, league_slot, joined_round, xp from public.clubs where league_id = p_league
  )
  select jsonb_build_object(
    'league',  (select to_jsonb(lg) from lg),
    'rounds',  coalesce((select jsonb_agg(jsonb_build_object('round', r.round, 'kickoff', r.kickoff) order by r.round)
                           from public.league_rounds r where r.league_id = p_league), '[]'::jsonb),
    'clubs',   coalesce((select jsonb_agg(to_jsonb(cl)) from cl), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('round', m.round, 'club_id', m.club_id, 'tick', m.tick, 'change', m.change))
                           from public.match_changes m where m.league_id = p_league), '[]'::jsonb),
    'logs',    coalesce((select jsonb_agg(to_jsonb(g))
                           from public.lineup_log_window((select array_agg(id) from cl), (select starts_at from lg)) g), '[]'::jsonb),
    'lots',    coalesce((select jsonb_agg(jsonb_build_object('round', a.round, 'idx', a.idx, 'ends_at', a.ends_at, 'best_club', a.best_club))
                           from public.auction_lots a where a.best_club in (select id from cl) and a.ends_at < now()), '[]'::jsonb)
  )
$$;
revoke all on function public.league_bundle(bigint) from public, anon;
grant execute on function public.league_bundle(bigint) to authenticated;
