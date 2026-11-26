-- =====================================================================
-- Prancheta — eventos: "a confirmar" numa consulta só
--
-- A tela de eventos mostra o que ainda vai entrar no progresso: os jogos já
-- disputados na temporada e nas copas em andamento. Antes, o aparelho baixava
-- a liga inteira e cada copa e recalculava tudo (~2–3 s). Agora soma o que o
-- servidor já gravou jogo a jogo (match_points): mesmo resultado, uma consulta.
-- (Jogos entram ~10 min depois do apito, quando a rodada é pontuada.)
-- =====================================================================

create or replace function public.my_pending_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  with mine as (
    select mp.*
      from public.match_points mp
     where mp.club_id = auth.uid()
       and ((mp.kind = 0 and exists (select 1 from public.leagues l where l.id = mp.ref_id and l.closed_at is null))
         or (mp.kind = 1 and exists (select 1 from public.cups c where c.id = mp.ref_id and c.closed_at is null)))
  )
  select jsonb_build_object(
    'games',        count(*),
    'wins',         count(*) filter (where result = 2),
    'goals',        coalesce(sum(gf), 0),
    'clean_sheets', count(*) filter (where ga = 0),
    'big_wins',     count(*) filter (where big_win),
    'cup_games',    count(*) filter (where kind = 1),
    'cup_wins',     count(*) filter (where kind = 1 and advanced)
  )
  from mine
$$;
revoke all on function public.my_pending_stats() from public, anon;
grant execute on function public.my_pending_stats() to authenticated;
