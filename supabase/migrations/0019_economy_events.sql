-- =====================================================================
-- Prancheta — economia recalibrada + eventos semanais
--
-- 1. Prêmios maiores (espelho de lib/economy.ts e CUP_KINDS):
--    temporada: 1º lugar 1.200 (Várzea) … 7.000 (Lendas), +50% para o campeão,
--    caindo até 25% no último; copas até 1.500 / 4.000 / 6.000.
--    Todo clube começa com 1.500 moedas.
-- 2. O fechamento da temporada e da copa grava os números de cada clube
--    (jogos, vitórias, gols, jogos sem sofrer gol, goleadas), calculados pela
--    Edge Function com o mesmo motor do jogo.
-- 3. Eventos semanais (segunda 0h → domingo 23h59, Brasília): um tema por semana
--    em rodízio (event_templates), com missões que pagam moedas. O progresso
--    sai só do que o servidor gravou (temporadas e copas FECHADAS na semana);
--    claim_mission() confere e paga uma vez por missão.
-- =====================================================================

/* ------------------------------------------------------------ prêmios */

alter table public.clubs alter column coins set default 1500;
update public.clubs set coins = coins + 500 where coins < 1500;

create or replace function public.season_prize(p_division smallint, p_pos smallint, p_size smallint) returns integer
language sql immutable as $$
  select round(b * (p_size - p_pos + 3)::numeric / (p_size + 2))::int + case when p_pos = 1 then round(b / 2.0)::int else 0 end
    from (select (array[1200, 1800, 2600, 3600, 5000, 7000])[least(greatest(p_division, 0), 5) + 1] as b) x
$$;

create or replace function public.cup_prize(p_kind smallint, p_reach smallint) returns integer
language sql immutable as $$
  select case p_kind
    when 1 then (array[0, 100, 200, 400, 800, 2000, 4000])[least(greatest(p_reach, 0), 6) + 1]
    when 2 then (array[500, 1000, 1800, 3000, 6000])[least(greatest(p_reach, 0), 4) + 1]
    else (array[0, 100, 200, 400, 800, 1500])[least(greatest(p_reach, 0), 5) + 1]
  end
$$;

/* ------------------------------------------- números por temporada/copa */

alter table public.club_seasons
  add column if not exists games smallint not null default 0,
  add column if not exists wins smallint not null default 0,
  add column if not exists draws smallint not null default 0,
  add column if not exists goals_for smallint not null default 0,
  add column if not exists goals_against smallint not null default 0,
  add column if not exists clean_sheets smallint not null default 0,
  add column if not exists big_wins smallint not null default 0;

alter table public.cup_entries
  add column if not exists games smallint not null default 0,
  add column if not exists wins smallint not null default 0,
  add column if not exists cup_wins smallint not null default 0,
  add column if not exists goals_for smallint not null default 0,
  add column if not exists goals_against smallint not null default 0,
  add column if not exists clean_sheets smallint not null default 0,
  add column if not exists big_wins smallint not null default 0;

-- lê um número do json de estatísticas com teto (trava contra valores absurdos)
create or replace function public.stat_of(p jsonb, k text, cap int) returns smallint
language sql immutable as $$
  select least(cap, greatest(0, coalesce((p ->> k)::int, 0)))::smallint
$$;

-- close_league: + p_stats { "<club_id>": {games, wins, draws, goals_for, goals_against, clean_sheets, big_wins} }
drop function if exists public.close_league(bigint, text, smallint[], jsonb);
create or replace function public.close_league(p_league bigint, p_final text, p_points smallint[], p_xp jsonb default '{}'::jsonb, p_stats jsonb default '{}'::jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  lg public.leagues;
  rules record;
  i int;
begin
  select * into lg from public.leagues where id = p_league for update;
  if not found then raise exception 'liga não encontrada' using errcode = 'P0002'; end if;
  if lg.closed_at is not null then return lg.final; end if;
  if lg.ends_at > now() then raise exception 'temporada em andamento' using errcode = 'P0001'; end if;

  if length(p_final) <> lg.size or coalesce(array_length(p_points, 1), 0) <> lg.size then
    raise exception 'resultado inválido' using errcode = '22023';
  end if;
  for i in 0..lg.size - 1 loop
    if position(substr('0123456789abcdefghij', i + 1, 1) in p_final) = 0 then
      raise exception 'resultado inválido' using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(coalesce(p_xp, '{}'::jsonb)) <> 'object' or jsonb_typeof(coalesce(p_stats, '{}'::jsonb)) <> 'object' then
    raise exception 'dados inválidos' using errcode = '22023';
  end if;

  select * into rules from public.division_rules(lg.division);
  update public.leagues set closed_at = now(), final = p_final where id = p_league;

  insert into public.club_seasons (club_id, league_id, division, pos, pts, move, coins,
                                   games, wins, draws, goals_for, goals_against, clean_sheets, big_wins)
  select c.id, lg.id, lg.division, p.pos, p_points[c.league_slot + 1],
         case
           when c.division <> lg.division then 0
           when rules.up > 0 and p.pos <= rules.up then 1
           when rules.down > 0 and p.pos > lg.size - rules.down then -1
           else 0
         end,
         public.season_prize(lg.division, p.pos, lg.size),
         public.stat_of(st, 'games', 50), public.stat_of(st, 'wins', 50), public.stat_of(st, 'draws', 50),
         public.stat_of(st, 'goals_for', 500), public.stat_of(st, 'goals_against', 500),
         public.stat_of(st, 'clean_sheets', 50), public.stat_of(st, 'big_wins', 50)
    from public.clubs c
    cross join lateral (select position(substr('0123456789abcdefghij', c.league_slot + 1, 1) in p_final)::smallint as pos) p
    cross join lateral (select coalesce(p_stats -> c.id::text, '{}'::jsonb) as st) s
   where c.league_id = lg.id
  on conflict do nothing;

  update public.clubs c
     set xp = (
       select array_agg(
                least(32000,
                  coalesce(c.xp[k], 0)
                  + least(3000, greatest(0, coalesce((p_xp -> c.id::text ->> (k - 1))::int, 0)))
                  + s.bonus
                )::smallint order by k)
         from generate_series(1, least(1296, greatest(14, coalesce(cardinality(c.xp), 0),
                case when jsonb_typeof(p_xp -> c.id::text) = 'array' then jsonb_array_length(p_xp -> c.id::text) else 0 end))) k),
         coins = c.coins + s.coins
    from (select club_id, coins,
                 (case when move > 0 then 40 else 0 end) + (case when pos = 1 then 60 else 0 end) as bonus
            from public.club_seasons where league_id = lg.id) s
   where s.club_id = c.id and c.league_id = lg.id;

  update public.clubs c
     set division = c.division + s.move
    from public.club_seasons s
   where s.league_id = lg.id and s.club_id = c.id and s.move <> 0 and c.division = lg.division;

  return p_final;
end $$;
revoke all on function public.close_league(bigint, text, smallint[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.close_league(bigint, text, smallint[], jsonb, jsonb) to service_role;

-- close_cup: + p_stats { "<slot>": {games, wins, cup_wins, goals_for, goals_against, clean_sheets, big_wins} }
drop function if exists public.close_cup(bigint, smallint[]);
create or replace function public.close_cup(p_cup bigint, p_reach smallint[], p_stats jsonb default '{}'::jsonb)
returns smallint
language plpgsql security definer set search_path = public as $$
declare
  cp public.cups;
  total int;
  r int;
  champ int;
begin
  select * into cp from public.cups where id = p_cup for update;
  if not found then raise exception 'copa não encontrada' using errcode = 'P0002'; end if;
  if cp.closed_at is not null then return cp.champion; end if;
  if cp.ends_at > now() then raise exception 'copa em andamento' using errcode = 'P0001'; end if;
  total := round(log(2, cp.size))::int;
  if coalesce(cardinality(p_reach), 0) <> cp.size then raise exception 'resultado inválido' using errcode = '22023'; end if;
  for r in 0..total loop
    if (select count(*) from unnest(p_reach) x where x = r) <> (case when r = total then 1 else (cp.size / power(2, r + 1))::int end) then
      raise exception 'resultado inválido' using errcode = '22023';
    end if;
  end loop;
  if jsonb_typeof(coalesce(p_stats, '{}'::jsonb)) <> 'object' then raise exception 'dados inválidos' using errcode = '22023'; end if;
  champ := array_position(p_reach, total::smallint) - 1;

  update public.cups set closed_at = now(), champion = champ where id = p_cup;
  update public.cup_entries e
     set reach = p_reach[e.slot + 1],
         coins = public.cup_prize(cp.kind, p_reach[e.slot + 1]),
         games = public.stat_of(coalesce(p_stats -> e.slot::text, '{}'::jsonb), 'games', 10),
         wins = public.stat_of(coalesce(p_stats -> e.slot::text, '{}'::jsonb), 'wins', 10),
         cup_wins = public.stat_of(coalesce(p_stats -> e.slot::text, '{}'::jsonb), 'cup_wins', 10),
         goals_for = public.stat_of(coalesce(p_stats -> e.slot::text, '{}'::jsonb), 'goals_for', 100),
         goals_against = public.stat_of(coalesce(p_stats -> e.slot::text, '{}'::jsonb), 'goals_against', 100),
         clean_sheets = public.stat_of(coalesce(p_stats -> e.slot::text, '{}'::jsonb), 'clean_sheets', 10),
         big_wins = public.stat_of(coalesce(p_stats -> e.slot::text, '{}'::jsonb), 'big_wins', 10)
   where e.cup_id = p_cup;
  update public.clubs c set coins = c.coins + e.coins
    from public.cup_entries e
   where e.cup_id = p_cup and e.club_id = c.id and e.coins > 0;
  return champ;
end $$;
revoke all on function public.close_cup(bigint, smallint[], jsonb) from public, anon, authenticated;
grant execute on function public.close_cup(bigint, smallint[], jsonb) to service_role;

/* ------------------------------------------------------------- eventos */

-- temas que se revezam semana a semana; missions = [{metric, target, reward, label}]
-- métricas: games, wins, goals, clean_sheets, big_wins (liga + copas), cup_games,
-- cup_wins, cups (copas disputadas), seasons, top4, titles, promotions
create table if not exists public.event_templates (
  id          smallint primary key,
  slug        text not null unique,
  name        text not null,
  description text not null,
  missions    jsonb not null check (jsonb_typeof(missions) = 'array')
);

create table if not exists public.events (
  week_start date primary key,               -- segunda-feira (Brasília)
  template   smallint not null references public.event_templates (id)
);

create table if not exists public.event_claims (
  club_id    uuid not null references public.clubs (id) on delete cascade,
  week_start date not null,
  mission    smallint not null,
  coins      integer not null,
  claimed_at timestamptz not null default now(),
  primary key (club_id, week_start, mission)
);

insert into public.event_templates (id, slug, name, description, missions) values
(0, 'artilheiro', 'Semana do Artilheiro', 'Bola na rede! Gols, goleadas e muito jogo valem moedas nesta semana.',
 '[{"metric":"goals","target":15,"reward":300,"label":"Marque 15 gols"},
   {"metric":"goals","target":40,"reward":800,"label":"Marque 40 gols"},
   {"metric":"big_wins","target":3,"reward":500,"label":"Vença 3 jogos por 3 gols de diferença"},
   {"metric":"cups","target":2,"reward":300,"label":"Dispute 2 copas"},
   {"metric":"games","target":30,"reward":600,"label":"Jogue 30 partidas"},
   {"metric":"top4","target":1,"reward":500,"label":"Termine uma temporada no G4"}]'),
(1, 'muralha', 'Semana da Muralha', 'Defesa que ganha campeonato. Segure o zero e some moedas.',
 '[{"metric":"clean_sheets","target":3,"reward":400,"label":"Termine 3 jogos sem sofrer gol"},
   {"metric":"clean_sheets","target":8,"reward":900,"label":"Termine 8 jogos sem sofrer gol"},
   {"metric":"wins","target":8,"reward":500,"label":"Vença 8 jogos"},
   {"metric":"games","target":25,"reward":500,"label":"Jogue 25 partidas"},
   {"metric":"cup_wins","target":3,"reward":400,"label":"Avance 3 fases em copas"},
   {"metric":"seasons","target":1,"reward":300,"label":"Complete uma temporada"}]'),
(2, 'maratona', 'Maratona da Bola', 'Quem joga mais, ganha mais. Liga e copas todo dia.',
 '[{"metric":"games","target":20,"reward":400,"label":"Jogue 20 partidas"},
   {"metric":"games","target":45,"reward":1000,"label":"Jogue 45 partidas"},
   {"metric":"cups","target":3,"reward":400,"label":"Dispute 3 copas"},
   {"metric":"cup_games","target":6,"reward":400,"label":"Jogue 6 partidas de copa"},
   {"metric":"seasons","target":2,"reward":500,"label":"Complete 2 temporadas"},
   {"metric":"wins","target":10,"reward":300,"label":"Vença 10 jogos"}]'),
(3, 'titulo', 'Rumo ao Título', 'Semana decisiva: vitórias, acesso e taça valem as maiores recompensas.',
 '[{"metric":"wins","target":6,"reward":400,"label":"Vença 6 jogos"},
   {"metric":"wins","target":15,"reward":900,"label":"Vença 15 jogos"},
   {"metric":"top4","target":1,"reward":500,"label":"Termine uma temporada no G4"},
   {"metric":"promotions","target":1,"reward":600,"label":"Conquiste um acesso"},
   {"metric":"cup_wins","target":4,"reward":400,"label":"Avance 4 fases em copas"},
   {"metric":"titles","target":1,"reward":700,"label":"Seja campeão de uma temporada"}]')
on conflict (id) do update set slug = excluded.slug, name = excluded.name, description = excluded.description, missions = excluded.missions;

-- segunda-feira da semana (Brasília) de um instante
create or replace function public.week_of(t timestamptz) returns date
language sql immutable as $$
  select date_trunc('week', t at time zone 'America/Sao_Paulo')::date
$$;

-- evento da semana atual (cria na primeira consulta da semana)
create or replace function public.current_event()
returns table (week_start date, ends_at timestamptz, template smallint, slug text, name text, description text, missions jsonb)
language plpgsql security definer set search_path = public as $$
declare
  w date := public.week_of(now());
  n int := (select count(*) from public.event_templates);
begin
  insert into public.events (week_start, template)
  values (w, (((w - date '2026-11-23') / 7) % n + n) % n)
  on conflict do nothing;
  return query
    select e.week_start, ((e.week_start + 7)::timestamp at time zone 'America/Sao_Paulo'), t.id, t.slug, t.name, t.description, t.missions
      from public.events e join public.event_templates t on t.id = e.template
     where e.week_start = w;
end $$;
revoke all on function public.current_event() from public, anon;
grant execute on function public.current_event() to authenticated;

-- números da semana do técnico logado (temporadas e copas fechadas na semana)
create or replace function public.event_progress(p_club uuid, p_week date) returns jsonb
language sql stable security definer set search_path = public as $$
  with win as (
    select (p_week::timestamp at time zone 'America/Sao_Paulo') as a,
           ((p_week + 7)::timestamp at time zone 'America/Sao_Paulo') as b
  ),
  s as (
    select coalesce(sum(cs.games), 0) games, coalesce(sum(cs.wins), 0) wins, coalesce(sum(cs.goals_for), 0) goals,
           coalesce(sum(cs.clean_sheets), 0) clean_sheets, coalesce(sum(cs.big_wins), 0) big_wins,
           count(*) seasons, count(*) filter (where cs.pos <= 4) top4, count(*) filter (where cs.pos = 1) titles,
           count(*) filter (where cs.move > 0) promotions
      from public.club_seasons cs join public.leagues l on l.id = cs.league_id, win
     where cs.club_id = p_club and l.closed_at >= win.a and l.closed_at < win.b
  ),
  c as (
    select coalesce(sum(e.games), 0) games, coalesce(sum(e.wins), 0) wins, coalesce(sum(e.cup_wins), 0) cup_wins,
           coalesce(sum(e.goals_for), 0) goals, coalesce(sum(e.clean_sheets), 0) clean_sheets,
           coalesce(sum(e.big_wins), 0) big_wins, count(*) cups
      from public.cup_entries e join public.cups cp on cp.id = e.cup_id, win
     where e.club_id = p_club and cp.closed_at >= win.a and cp.closed_at < win.b
  )
  select jsonb_build_object(
    'games', s.games + c.games, 'wins', s.wins + c.wins, 'goals', s.goals + c.goals,
    'clean_sheets', s.clean_sheets + c.clean_sheets, 'big_wins', s.big_wins + c.big_wins,
    'cup_games', c.games, 'cup_wins', c.cup_wins, 'cups', c.cups,
    'seasons', s.seasons, 'top4', s.top4, 'titles', s.titles, 'promotions', s.promotions)
  from s, c
$$;
revoke all on function public.event_progress(uuid, date) from public, anon, authenticated;

-- progresso + resgates do técnico logado na semana atual
create or replace function public.my_event_progress() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'progress', public.event_progress(auth.uid(), public.week_of(now())),
    'claimed', coalesce((select jsonb_agg(mission order by mission) from public.event_claims
                          where club_id = auth.uid() and week_start = public.week_of(now())), '[]'::jsonb))
$$;
revoke all on function public.my_event_progress() from public, anon;
grant execute on function public.my_event_progress() to authenticated;

-- resgata a recompensa de uma missão da semana atual (uma vez)
create or replace function public.claim_mission(p_mission smallint) returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ev record;
  m jsonb;
  have int;
  reward int;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if not exists (select 1 from public.clubs where id = uid) then raise exception 'clube não encontrado' using errcode = 'P0002'; end if;
  select * into ev from public.current_event();
  m := ev.missions -> p_mission;
  if m is null then raise exception 'missão inválida' using errcode = '22023'; end if;
  have := coalesce((public.event_progress(uid, ev.week_start) ->> (m ->> 'metric'))::int, 0);
  if have < (m ->> 'target')::int then raise exception 'missão incompleta' using errcode = 'P0011'; end if;
  reward := (m ->> 'reward')::int;
  begin
    insert into public.event_claims (club_id, week_start, mission, coins) values (uid, ev.week_start, p_mission, reward);
  exception when unique_violation then
    raise exception 'recompensa já resgatada' using errcode = 'P0012';
  end;
  update public.clubs set coins = coins + reward where id = uid;
  return reward;
end $$;
revoke all on function public.claim_mission(smallint) from public, anon;
grant execute on function public.claim_mission(smallint) to authenticated;

alter table public.event_templates enable row level security;
alter table public.events enable row level security;
alter table public.event_claims enable row level security;
drop policy if exists "event_templates: leitura" on public.event_templates;
create policy "event_templates: leitura" on public.event_templates for select to authenticated using (true);
drop policy if exists "events: leitura" on public.events;
create policy "events: leitura" on public.events for select to authenticated using (true);
drop policy if exists "event_claims: dono" on public.event_claims;
create policy "event_claims: dono" on public.event_claims for select to authenticated using (club_id = (select auth.uid()));
revoke all on public.event_templates, public.events, public.event_claims from anon, authenticated;
grant select on public.event_templates, public.events, public.event_claims to authenticated;
