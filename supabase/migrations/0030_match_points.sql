-- =====================================================================
-- Prancheta — ranking pontua logo depois de cada partida
--
-- A Edge Function score-round recalcula uma rodada da liga (ou fase de copa)
-- assim que ela termina, com o mesmo motor do jogo, e grava o resultado de
-- cada técnico real em match_points. O fechamento de liga/copa grava as
-- rodadas que ninguém pediu (nada fica de fora). Uma rodada é gravada uma
-- vez só (scored_rounds).
--
-- Ranking (× divisão na liga, × copa nas copas):
--   jogo: vitória 10 · empate 3 · goleada (3+ gols) +5 · fase de copa vencida 15
--   no fechamento: título +150 · acesso +75 · campeão de copa +60
-- "Semana": jogos disputados nos últimos 7 dias + bônus de fechamentos.
-- =====================================================================

create table if not exists public.match_points (
  club_id   uuid not null references public.clubs (id) on delete cascade,
  kind      smallint not null check (kind in (0, 1)),          -- 0 liga, 1 copa
  ref_id    bigint not null,                                   -- liga ou copa
  round     smallint not null,
  tier      smallint not null,                                 -- divisão (liga) ou tipo de copa
  result    smallint not null check (result between 0 and 2),  -- 2 V, 1 E, 0 D
  gf        smallint not null,
  ga        smallint not null,
  big_win   boolean not null default false,
  advanced  boolean not null default false,
  played_at timestamptz not null,
  primary key (club_id, kind, ref_id, round)
);
create index if not exists match_points_recent on public.match_points (played_at);

create table if not exists public.scored_rounds (
  kind      smallint not null,
  ref_id    bigint not null,
  round     smallint not null,
  scored_at timestamptz not null default now(),
  primary key (kind, ref_id, round)
);

alter table public.match_points enable row level security;
alter table public.scored_rounds enable row level security;
drop policy if exists "match_points: leitura" on public.match_points;
create policy "match_points: leitura" on public.match_points for select to authenticated using (true);
revoke all on public.match_points, public.scored_rounds from anon, authenticated;
grant select on public.match_points to authenticated;

-- só a Edge Function (service_role): grava rodadas ainda não gravadas
-- p_rounds: [{ "round": 3, "played_at": "...", "rows": [{club_id, result, gf, ga, big_win, advanced}] }]
create or replace function public.record_rounds(p_kind smallint, p_ref bigint, p_tier smallint, p_rounds jsonb)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  rd jsonb;
  n int := 0;
  r int;
begin
  if p_kind not in (0, 1) or jsonb_typeof(p_rounds) <> 'array' then raise exception 'inválido' using errcode = '22023'; end if;
  for rd in select * from jsonb_array_elements(p_rounds) loop
    r := (rd ->> 'round')::int;
    insert into public.scored_rounds (kind, ref_id, round) values (p_kind, p_ref, r) on conflict do nothing;
    if not found then continue; end if;
    insert into public.match_points (club_id, kind, ref_id, round, tier, result, gf, ga, big_win, advanced, played_at)
    select (x ->> 'club_id')::uuid, p_kind, p_ref, r, p_tier,
           least(greatest((x ->> 'result')::int, 0), 2), least((x ->> 'gf')::int, 30), least((x ->> 'ga')::int, 30),
           coalesce((x ->> 'big_win')::boolean, false), coalesce((x ->> 'advanced')::boolean, false),
           (rd ->> 'played_at')::timestamptz
      from jsonb_array_elements(rd -> 'rows') x
     where exists (select 1 from public.clubs c where c.id = (x ->> 'club_id')::uuid)
    on conflict do nothing;
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function public.record_rounds(smallint, bigint, smallint, jsonb) from public, anon, authenticated;
grant execute on function public.record_rounds(smallint, bigint, smallint, jsonb) to service_role;

-- rodadas já gravadas (a função pula as que já estão)
create or replace function public.scored(p_kind smallint, p_ref bigint) returns smallint[]
language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(round order by round), '{}') from public.scored_rounds where kind = p_kind and ref_id = p_ref
$$;
revoke all on function public.scored(smallint, bigint) from public, anon;
grant execute on function public.scored(smallint, bigint) to authenticated, service_role;

drop function if exists public.ranking(boolean, int);
create or replace function public.ranking(p_week boolean default false, p_limit int default 50)
returns table (pos bigint, club_id uuid, name text, tag text, crest text, division smallint,
               score integer, wins integer, titles integer, cup_titles integer, seasons integer, me boolean)
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
