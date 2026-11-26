-- =====================================================================
-- Prancheta — ranking entre técnicos (só clubes reais; a CPU não entra)
--
-- Pontos de PRESTÍGIO, só de coisas já encerradas e gravadas pelo servidor
-- (ninguém forja pontuação):
--   • temporada fechada: pontos na tabela × divisão; título +50 × divisão;
--     acesso +25 × divisão      (divisão: Várzea ×1, D ×1,25, C ×1,5,
--                                 B ×2, A ×2,5, Lendas ×3)
--   • copa fechada: fase alcançada × 10 × copa; campeão +40 × copa
--                                (Várzea ×1, Nacional ×1,5, Supercopa ×2, Lendas ×3)
-- "Semana" = o mesmo, só com o que fechou nos últimos 7 dias.
-- Desempate: divisão atual, títulos, nome. Calculado na hora (sem tabela);
-- com muitos clubes, dá para materializar depois. Espelho: lib/ranking.ts.
-- =====================================================================

create or replace function public.division_mult(p_div smallint) returns numeric
language sql immutable as $$ select (array[1, 1.25, 1.5, 2, 2.5, 3])[least(greatest(p_div, 0), 5) + 1]::numeric $$;

create or replace function public.cup_mult(p_kind smallint) returns numeric
language sql immutable as $$ select (array[1, 1.5, 2, 3])[least(greatest(p_kind, 0), 3) + 1]::numeric $$;

create or replace function public.ranking(p_week boolean default false, p_limit int default 50)
returns table (pos bigint, club_id uuid, name text, tag text, crest text, division smallint,
               score integer, titles integer, cup_titles integer, seasons integer, me boolean)
language sql stable security definer set search_path = public as $$
  with since as (
    select case when p_week then now() - interval '7 days' else '-infinity'::timestamptz end as t
  ), s as (
    select cs.club_id,
           sum(round(cs.pts * division_mult(cs.division))
               + case when cs.pos = 1 then round(50 * division_mult(cs.division)) else 0 end
               + case when cs.move > 0 then round(25 * division_mult(cs.division)) else 0 end)::int as pts,
           count(*) filter (where cs.pos = 1)::int as titles,
           count(*)::int as seasons
      from club_seasons cs join leagues l on l.id = cs.league_id, since
     where l.closed_at is not null and l.closed_at >= since.t
     group by cs.club_id
  ), c as (
    select e.club_id,
           sum(round(e.reach * 10 * cup_mult(cp.kind))
               + case when e.reach >= round(log(2, cp.size)) then round(40 * cup_mult(cp.kind)) else 0 end)::int as pts,
           count(*) filter (where e.reach >= round(log(2, cp.size)))::int as cup_titles
      from cup_entries e join cups cp on cp.id = e.cup_id, since
     where cp.closed_at is not null and cp.closed_at >= since.t and e.reach is not null
     group by e.club_id
  ), all_clubs as (
    select cl.id, cl.name, cl.tag, cl.crest, cl.division,
           (coalesce(s.pts, 0) + coalesce(c.pts, 0))::int as score,
           coalesce(s.titles, 0) as titles, coalesce(c.cup_titles, 0) as cup_titles, coalesce(s.seasons, 0) as seasons
      from clubs cl
      left join s on s.club_id = cl.id
      left join c on c.club_id = cl.id
     where cl.squad is not null
  ), ranked as (
    select rank() over (order by score desc, division desc, titles + cup_titles desc) as pos, *
      from all_clubs
  )
  select r.pos, r.id, r.name, r.tag, r.crest, r.division, r.score, r.titles, r.cup_titles, r.seasons, r.id = auth.uid()
    from ranked r
   where r.pos <= least(greatest(p_limit, 1), 100) or r.id = auth.uid()
   order by r.pos, r.name
$$;
revoke all on function public.ranking(boolean, int) from public, anon;
grant execute on function public.ranking(boolean, int) to authenticated;
