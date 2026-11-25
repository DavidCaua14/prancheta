-- =====================================================================
-- Prancheta — Liga da Várzea
--
-- O banco NÃO guarda partidas nem placares. Como o motor é determinístico,
-- cada aparelho calcula os jogos a partir de:
--   • horários das rodadas            (league_rounds)
--   • quem ocupa cada vaga da liga    (clubs.league_id/league_slot/joined_round)
--   • escalação em vigor no apito     (lineup_log)
--   • mudanças feitas ao vivo         (match_changes)
-- Vagas sem dono são times da CPU, gerados no aparelho a partir do id da liga.
-- =====================================================================

/* ------------------------------------------------------------- ligas */

create table if not exists public.leagues (
  id         bigint generated always as identity primary key,
  division   smallint not null default 0,            -- 0 = Várzea
  size       smallint not null default 10 check (size between 4 and 20 and size % 2 = 0),
  rounds     smallint not null,
  starts_at  timestamptz not null,                   -- apito da 1ª rodada
  ends_at    timestamptz not null,                   -- apito da última rodada + 15 min
  created_at timestamptz not null default now()
);

create table if not exists public.league_rounds (
  league_id bigint not null references public.leagues (id) on delete cascade,
  round     smallint not null,
  kickoff   timestamptz not null,
  primary key (league_id, round)
);

alter table public.clubs add column if not exists league_id bigint references public.leagues (id) on delete set null;
alter table public.clubs add column if not exists league_slot smallint;
alter table public.clubs add column if not exists joined_round smallint;
create unique index if not exists clubs_league_slot on public.clubs (league_id, league_slot) where league_id is not null;

/* --------------------------------------------- horários das rodadas */

-- Rodadas às 8h, 10h, 12h, 14h, 16h, 18h, 20h e 22h (Brasília).
create or replace function public.next_round_slot(t timestamptz) returns timestamptz
language plpgsql stable as $$
declare
  loc timestamp := t at time zone 'America/Sao_Paulo';
  h int;
begin
  if loc > date_trunc('hour', loc) then loc := date_trunc('hour', loc) + interval '1 hour'; end if;
  h := extract(hour from loc)::int;
  if h % 2 = 1 then loc := loc + interval '1 hour'; h := h + 1; end if;
  h := extract(hour from loc)::int;
  if h < 8 then loc := date_trunc('day', loc) + interval '8 hours';
  elsif h > 22 then loc := date_trunc('day', loc) + interval '1 day 8 hours';
  end if;
  return loc at time zone 'America/Sao_Paulo';
end $$;

-- Cria uma liga com a 1ª rodada no próximo horário (com pelo menos 15 min de folga).
create or replace function public.create_league(p_division smallint default 0, p_size smallint default 10)
returns public.leagues
language plpgsql security definer set search_path = public as $$
declare
  n_rounds smallint := (p_size - 1) * 2;
  k timestamptz := public.next_round_slot(now() + interval '15 minutes');
  first_k timestamptz := k;
  lg public.leagues;
  r smallint;
begin
  insert into public.leagues (division, size, rounds, starts_at, ends_at)
  values (p_division, p_size, n_rounds, first_k, first_k) returning * into lg;
  for r in 1..n_rounds loop
    insert into public.league_rounds (league_id, round, kickoff) values (lg.id, r, k);
    if r < n_rounds then k := public.next_round_slot(k + interval '1 minute'); end if;
  end loop;
  update public.leagues set ends_at = k + interval '15 minutes' where id = lg.id returning * into lg;
  return lg;
end $$;
revoke all on function public.create_league(smallint, smallint) from public, anon, authenticated;

/* --------------------------------------------------- entrar na liga */

-- Coloca o clube do usuário numa Liga da Várzea:
--   1. se já está numa liga em andamento, fica nela;
--   2. senão, assume a vaga de um time da CPU numa liga com ≥ 6 rodadas pela frente
--      (preferindo ligas com mais humanos, para os técnicos se encontrarem);
--   3. senão, cria uma liga nova.
create or replace function public.join_league() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  my public.clubs;
  lg public.leagues;
  free_slot int;
  started int;
  attempt int := 0;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  select * into my from public.clubs where id = uid;
  if not found then raise exception 'clube não encontrado' using errcode = 'P0002'; end if;
  if my.squad is null then raise exception 'monte o elenco antes' using errcode = 'P0001'; end if;
  if my.league_id is not null and exists (select 1 from public.leagues where id = my.league_id and ends_at > now()) then
    return my.league_id;
  end if;

  loop
    attempt := attempt + 1;
    select l.* into lg
      from public.leagues l
     where l.division = 0
       and (select count(*) from public.league_rounds r where r.league_id = l.id and r.kickoff > now()) >= 6
       and (select count(*) from public.clubs c where c.league_id = l.id) < l.size
     order by (select count(*) from public.clubs c where c.league_id = l.id) desc, l.starts_at
     limit 1
     for update;
    if not found then
      lg := public.create_league(0::smallint, 10::smallint);
    end if;

    select s into free_slot
      from generate_series(0, lg.size - 1) s
     where s not in (select c.league_slot from public.clubs c where c.league_id = lg.id)
     order by random()
     limit 1;
    select count(*) into started from public.league_rounds where league_id = lg.id and kickoff <= now();

    begin
      update public.clubs
         set league_id = lg.id, league_slot = free_slot, joined_round = started + 1
       where id = uid;
      return lg.id;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;
end $$;
revoke all on function public.join_league() from public, anon;
grant execute on function public.join_league() to authenticated;

/* ---------------------------------------- histórico de escalações */

create table if not exists public.lineup_log (
  club_id uuid not null references public.clubs (id) on delete cascade,
  at      timestamptz not null default now(),
  lineup  text not null,
  primary key (club_id, at)
);

create or replace function public.log_lineup() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  keep timestamptz;
begin
  if new.lineup is not null and new.lineup is distinct from old.lineup then
    insert into public.lineup_log (club_id, at, lineup) values (new.id, now(), new.lineup)
      on conflict (club_id, at) do update set lineup = excluded.lineup;
    -- limpeza: apaga o que tem mais de 10 dias, menos a última versão daquele período
    select max(at) into keep from public.lineup_log where club_id = new.id and at < now() - interval '10 days';
    if keep is not null then
      delete from public.lineup_log where club_id = new.id and at < keep;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists clubs_log_lineup on public.clubs;
create trigger clubs_log_lineup after update of lineup on public.clubs
  for each row execute function public.log_lineup();

insert into public.lineup_log (club_id, at, lineup)
  select id, now() - interval '1 day', lineup from public.clubs where lineup is not null
  on conflict do nothing;

/* ------------------------------------------ mudanças durante o jogo */

-- change: p0-p4 (postura), m0-m2 (marcação), s0-s2 (passes), xAB (substituição: sai A, entra B)
create table if not exists public.match_changes (
  league_id  bigint not null references public.leagues (id) on delete cascade,
  round      smallint not null,
  club_id    uuid not null references public.clubs (id) on delete cascade,
  tick       smallint not null check (tick between 1 and 100),
  change     text not null check (change ~ '^(p[0-4]|m[0-2]|s[0-2]|x[0-9a-d]{2})$'),
  created_at timestamptz not null default now(),
  primary key (league_id, round, club_id, tick, change)
);

-- 1 minuto de jogo = 6 segundos. A mudança precisa valer para um minuto que
-- ainda não aconteceu (com 3 s de folga) — ninguém muda o passado.
create or replace function public.match_change_ok(p_league bigint, p_round smallint, p_club uuid, p_tick smallint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.league_rounds r
      join public.clubs c on c.id = p_club and c.league_id = r.league_id
     where r.league_id = p_league and r.round = p_round
       and c.joined_round <= p_round
       and r.kickoff + make_interval(secs => p_tick * 6) > now() + interval '3 seconds'
       and r.kickoff <= now() + interval '2 hours'
  )
  and (select count(*) from public.match_changes m where m.league_id = p_league and m.round = p_round and m.club_id = p_club) < 30
$$;

/* ------------------------------------------------------------- RLS */

alter table public.leagues enable row level security;
alter table public.league_rounds enable row level security;
alter table public.lineup_log enable row level security;
alter table public.match_changes enable row level security;

drop policy if exists "leagues: leitura" on public.leagues;
create policy "leagues: leitura" on public.leagues for select to authenticated using (true);
drop policy if exists "league_rounds: leitura" on public.league_rounds;
create policy "league_rounds: leitura" on public.league_rounds for select to authenticated using (true);
drop policy if exists "lineup_log: leitura" on public.lineup_log;
create policy "lineup_log: leitura" on public.lineup_log for select to authenticated using (true);
drop policy if exists "match_changes: leitura" on public.match_changes;
create policy "match_changes: leitura" on public.match_changes for select to authenticated using (true);
drop policy if exists "match_changes: técnico do clube" on public.match_changes;
create policy "match_changes: técnico do clube" on public.match_changes for insert to authenticated
  with check (club_id = (select auth.uid()) and public.match_change_ok(league_id, round, club_id, tick));

revoke all on public.leagues, public.league_rounds, public.lineup_log, public.match_changes from anon, authenticated;
grant select on public.leagues, public.league_rounds, public.lineup_log, public.match_changes to authenticated;
grant insert (league_id, round, club_id, tick, change) on public.match_changes to authenticated;
