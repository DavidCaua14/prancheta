-- =====================================================================
-- Prancheta — subida no ranking (fim de jogo, com animação)
--
-- club_scores(semana): a pontuação de cada clube (mesma conta do ranking,
-- agora num lugar só). ranking() passa a usá-la.
-- rank_climb(pontos do jogo): posição antes do jogo (minha pontuação sem os
-- pontos dele, contra a pontuação atual dos outros), posição agora e quem
-- eu ultrapassei (até 3). Ordem = a do ranking: pontos, divisão, títulos, vitórias.
-- =====================================================================

create or replace function public.club_scores(p_week boolean default false)
returns table (club_id uuid, name text, tag text, crest text, division smallint,
               score integer, wins integer, titles integer, cup_titles integer, seasons integer)
language sql stable security definer set search_path = public as $$
  with since as (
    select case when p_week then now() - interval '7 days' else '-infinity'::timestamptz end as t
  ), m as (     -- jogo a jogo
    select mp.club_id,
           sum(case when mp.kind = 0
                    then round(((case mp.result when 2 then 10 when 1 then 3 else 0 end) + (case when mp.big_win then 5 else 0 end))
                               * division_mult(mp.tier))
                    else round((case when mp.advanced then 15 else 0 end) * cup_mult(mp.tier)) end)::int as pts,
           count(*) filter (where (mp.kind = 0 and mp.result = 2) or (mp.kind = 1 and mp.advanced))::int as wins
      from match_points mp, since
     where mp.played_at >= since.t
     group by mp.club_id
  ), s as (     -- bônus de fim de temporada
    select cs.club_id,
           sum(round(((case when cs.pos = 1 then 150 else 0 end) + (case when cs.move > 0 then 75 else 0 end)) * division_mult(cs.division)))::int as pts,
           count(*) filter (where cs.pos = 1)::int as titles,
           count(*)::int as seasons
      from club_seasons cs join leagues l on l.id = cs.league_id, since
     where l.closed_at is not null and l.closed_at >= since.t
     group by cs.club_id
  ), c as (     -- bônus de campeão de copa
    select e.club_id, sum(round(60 * cup_mult(cp.kind)))::int as pts, count(*)::int as cup_titles
      from cup_entries e join cups cp on cp.id = e.cup_id, since
     where cp.closed_at is not null and cp.closed_at >= since.t and e.reach >= round(log(2, cp.size))
     group by e.club_id
  ), all_clubs as (
    select cl.id, cl.name, cl.tag, cl.crest, cl.division,
           (coalesce(m.pts, 0) + coalesce(s.pts, 0) + coalesce(c.pts, 0))::int as score,
           coalesce(m.wins, 0) as wins,
           coalesce(s.titles, 0) as titles, coalesce(c.cup_titles, 0) as cup_titles, coalesce(s.seasons, 0) as seasons
      from clubs cl
      left join m on m.club_id = cl.id
      left join s on s.club_id = cl.id
      left join c on c.club_id = cl.id
     where cl.squad is not null
  )
  select id, name, tag, crest, division, score, wins, titles, cup_titles, seasons from all_clubs
$$;
revoke all on function public.club_scores(boolean) from public, anon, authenticated;

drop function if exists public.ranking(boolean, int);
create or replace function public.ranking(p_week boolean default false, p_limit int default 50)
returns table (pos bigint, club_id uuid, name text, tag text, crest text, division smallint,
               score integer, wins integer, titles integer, cup_titles integer, seasons integer, me boolean)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select rank() over (order by s.score desc, s.division desc, s.titles + s.cup_titles desc, s.wins desc) as pos, s.*
      from public.club_scores(p_week) s
  )
  select r.pos, r.club_id, r.name, r.tag, r.crest, r.division, r.score, r.wins, r.titles, r.cup_titles, r.seasons, r.club_id = auth.uid()
    from ranked r
   where r.pos <= least(greatest(p_limit, 1), 100) or r.club_id = auth.uid()
   order by r.pos, r.name
$$;
revoke all on function public.ranking(boolean, int) from public, anon;
grant execute on function public.ranking(boolean, int) to authenticated;

create or replace function public.rank_climb(p_pts integer, p_win boolean default false)
returns table (before bigint, after bigint, passed jsonb)
language sql stable security definer set search_path = public as $$
  with s as (select * from public.club_scores(false)),
  me as (select * from s where s.club_id = auth.uid()),
  pre as (  -- eu antes do jogo
    select me.score - greatest(p_pts, 0) as score, me.division, me.titles + me.cup_titles as t,
           me.wins - (case when p_win then 1 else 0 end) as wins from me
  ),
  others as (select s.* from s, me where s.club_id <> me.club_id)
  select
    1 + (select count(*) from others o, pre where (o.score, o.division, o.titles + o.cup_titles, o.wins) > (pre.score, pre.division, pre.t, pre.wins)),
    1 + (select count(*) from others o, me where (o.score, o.division, o.titles + o.cup_titles, o.wins) > (me.score, me.division, me.titles + me.cup_titles, me.wins)),
    coalesce((select jsonb_agg(jsonb_build_object('name', x.name, 'tag', x.tag, 'crest', x.crest) order by x.score desc)
                from (select o.* from others o, pre, me
                       where (o.score, o.division, o.titles + o.cup_titles, o.wins) > (pre.score, pre.division, pre.t, pre.wins)
                         and not (o.score, o.division, o.titles + o.cup_titles, o.wins) > (me.score, me.division, me.titles + me.cup_titles, me.wins)
                       order by o.score desc limit 3) x), '[]'::jsonb)
    from me
$$;
revoke all on function public.rank_climb(integer, boolean) from public, anon;
grant execute on function public.rank_climb(integer, boolean) to authenticated;
