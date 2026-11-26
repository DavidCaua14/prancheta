-- =====================================================================
-- Prancheta — ranking: vitória vale pontos (explícito)
--
-- Liga (× divisão: Várzea ×1, D ×1,25, C ×1,5, B ×2, A ×2,5, Lendas ×3):
--   vitória 10 · empate 3 · goleada (3+ gols de diferença) +5 ·
--   título +150 · acesso +75
-- Copa (× copa: Várzea ×1, Nacional ×1,5, Supercopa ×2, Lendas ×3):
--   cada fase vencida 15 · campeão +60
-- Vitórias, empates e goleadas vêm de club_seasons / cup_entries, gravados
-- pelo servidor no fechamento (close_league / close_cup). Espelho: lib/ranking.ts.
-- =====================================================================

drop function if exists public.ranking(boolean, int);
create or replace function public.ranking(p_week boolean default false, p_limit int default 50)
returns table (pos bigint, club_id uuid, name text, tag text, crest text, division smallint,
               score integer, wins integer, titles integer, cup_titles integer, seasons integer, me boolean)
language sql stable security definer set search_path = public as $$
  with since as (
    select case when p_week then now() - interval '7 days' else '-infinity'::timestamptz end as t
  ), s as (
    select cs.club_id,
           sum(round((cs.wins * 10 + cs.draws * 3 + cs.big_wins * 5
                      + case when cs.pos = 1 then 150 else 0 end
                      + case when cs.move > 0 then 75 else 0 end) * division_mult(cs.division)))::int as pts,
           sum(cs.wins)::int as wins,
           count(*) filter (where cs.pos = 1)::int as titles,
           count(*)::int as seasons
      from club_seasons cs join leagues l on l.id = cs.league_id, since
     where l.closed_at is not null and l.closed_at >= since.t
     group by cs.club_id
  ), c as (
    select e.club_id,
           sum(round((e.reach * 15
                      + case when e.reach >= round(log(2, cp.size)) then 60 else 0 end) * cup_mult(cp.kind)))::int as pts,
           sum(e.reach)::int as wins,
           count(*) filter (where e.reach >= round(log(2, cp.size)))::int as cup_titles
      from cup_entries e join cups cp on cp.id = e.cup_id, since
     where cp.closed_at is not null and cp.closed_at >= since.t and e.reach is not null
     group by e.club_id
  ), all_clubs as (
    select cl.id, cl.name, cl.tag, cl.crest, cl.division,
           (coalesce(s.pts, 0) + coalesce(c.pts, 0))::int as score,
           (coalesce(s.wins, 0) + coalesce(c.wins, 0))::int as wins,
           coalesce(s.titles, 0) as titles, coalesce(c.cup_titles, 0) as cup_titles, coalesce(s.seasons, 0) as seasons
      from clubs cl
      left join s on s.club_id = cl.id
      left join c on c.club_id = cl.id
     where cl.squad is not null
  ), ranked as (
    select rank() over (order by score desc, division desc, titles + cup_titles desc, wins desc) as pos, *
      from all_clubs
  )
  select r.pos, r.id, r.name, r.tag, r.crest, r.division, r.score, r.wins, r.titles, r.cup_titles, r.seasons, r.id = auth.uid()
    from ranked r
   where r.pos <= least(greatest(p_limit, 1), 100) or r.id = auth.uid()
   order by r.pos, r.name
$$;
revoke all on function public.ranking(boolean, int) from public, anon;
grant execute on function public.ranking(boolean, int) to authenticated;
