-- =====================================================================
-- Prancheta — Copas (começando pela Copa da Várzea, kind = 0)
--
-- Mata-mata diário de 32 clubes: fases às 13h, 15h, 17h, 19h e 21h
-- (Brasília), inscrição até 12h45. Vagas sem técnico = CPU. O banco guarda
-- só a edição e as inscrições; jogos, chaveamento e placares são calculados
-- no aparelho (lib/cup/core.ts). A Edge Function close-cup recalcula tudo
-- e chama close_cup() para gravar a fase alcançada e pagar os prêmios.
--
-- Na inscrição guardamos o XP das cartas: a força do clube fica congelada
-- durante a copa (a liga pode fechar no meio e mudar o XP).
-- =====================================================================

create table if not exists public.cups (
  id         bigint generated always as identity primary key,
  kind       smallint not null default 0,
  size       smallint not null default 32 check (size in (8, 16, 32, 64)),
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  closed_at  timestamptz,
  champion   smallint,
  created_at timestamptz not null default now()
);
create index if not exists cups_open on public.cups (kind, starts_at) where closed_at is null;

create table if not exists public.cup_entries (
  cup_id    bigint not null references public.cups (id) on delete cascade,
  slot      smallint not null,
  club_id   uuid not null references public.clubs (id) on delete cascade,
  xp        smallint[],
  joined_at timestamptz not null default now(),
  reach     smallint,
  coins     integer,
  primary key (cup_id, slot),
  unique (cup_id, club_id)
);
create index if not exists cup_entries_club on public.cup_entries (club_id, cup_id desc);

-- moedas por fase alcançada (espelho de CUP_KINDS[0].prizes)
create or replace function public.cup_prize(p_kind smallint, p_reach smallint) returns integer
language sql immutable as $$
  select (array[0, 30, 60, 150, 300, 600])[least(greatest(p_reach, 0), 5) + 1]
$$;

/* ---------------------------------------------------- inscrição */

create or replace function public.join_cup(p_kind smallint default 0) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  my public.clubs;
  cid bigint;
  loc timestamp := now() at time zone 'America/Sao_Paulo';
  day date;
  start_at timestamptz;
  cp public.cups;
  free_slot int;
  attempt int := 0;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if p_kind <> 0 then raise exception 'copa indisponível' using errcode = '22023'; end if;
  select * into my from public.clubs where id = uid;
  if not found or my.squad is null then raise exception 'monte o elenco antes' using errcode = 'P0001'; end if;

  -- já inscrito numa edição que ainda não acabou: fica nela
  select c.id into cid
    from public.cup_entries e join public.cups c on c.id = e.cup_id
   where e.club_id = uid and c.kind = p_kind and c.ends_at > now()
   order by c.id desc limit 1;
  if found then return cid; end if;

  -- edição de hoje (até 12h45) ou de amanhã
  day := loc::date + case when loc::time < time '12:45' then 0 else 1 end;
  start_at := (day + time '13:00') at time zone 'America/Sao_Paulo';

  loop
    attempt := attempt + 1;
    select c.* into cp
      from public.cups c
     where c.kind = p_kind and c.starts_at = start_at
       and (select count(*) from public.cup_entries e where e.cup_id = c.id) < c.size
     order by (select count(*) from public.cup_entries e where e.cup_id = c.id) desc, c.id
     limit 1
     for update;
    if not found then
      insert into public.cups (kind, size, starts_at, ends_at)
      values (p_kind, 32, start_at, start_at + interval '8 hours 15 minutes')
      returning * into cp;
    end if;

    select s into free_slot
      from generate_series(0, cp.size - 1) s
     where s not in (select e.slot from public.cup_entries e where e.cup_id = cp.id)
     order by random() limit 1;

    begin
      insert into public.cup_entries (cup_id, slot, club_id, xp) values (cp.id, free_slot, uid, my.xp);
      return cp.id;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;
end $$;
revoke all on function public.join_cup(smallint) from public, anon;
grant execute on function public.join_cup(smallint) to authenticated;

/* ------------------------------------------ mudanças durante o jogo */

create table if not exists public.cup_changes (
  cup_id     bigint not null references public.cups (id) on delete cascade,
  round      smallint not null check (round between 1 and 6),
  club_id    uuid not null references public.clubs (id) on delete cascade,
  tick       smallint not null check (tick between 1 and 100),
  change     text not null check (change ~ '^(p[0-4]|m[0-2]|s[0-2]|x[0-9a-z]{2})$'),
  created_at timestamptz not null default now(),
  primary key (cup_id, round, club_id, tick, change)
);

create or replace function public.cup_change_ok(p_cup bigint, p_round smallint, p_club uuid, p_tick smallint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from public.cups c
      join public.cup_entries e on e.cup_id = c.id and e.club_id = p_club
     where c.id = p_cup
       and c.starts_at + make_interval(hours => (p_round - 1) * 2) + make_interval(secs => p_tick * 6) > now() + interval '3 seconds'
       and c.starts_at + make_interval(hours => (p_round - 1) * 2) <= now() + interval '2 hours'
  )
  and (select count(*) from public.cup_changes m where m.cup_id = p_cup and m.round = p_round and m.club_id = p_club) < 30
$$;

/* ------------------------------------------------- fechar a copa */

-- p_reach: fase alcançada por vaga (0 = caiu na 1ª fase ... log2(size) = campeão)
create or replace function public.close_cup(p_cup bigint, p_reach smallint[])
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
  -- chaveamento coerente: metade cai em cada fase, um campeão
  for r in 0..total loop
    if (select count(*) from unnest(p_reach) x where x = r) <> (case when r = total then 1 else (cp.size / power(2, r + 1))::int end) then
      raise exception 'resultado inválido' using errcode = '22023';
    end if;
  end loop;
  champ := array_position(p_reach, total::smallint) - 1;

  update public.cups set closed_at = now(), champion = champ where id = p_cup;
  update public.cup_entries e
     set reach = p_reach[e.slot + 1], coins = public.cup_prize(cp.kind, p_reach[e.slot + 1])
   where e.cup_id = p_cup;
  update public.clubs c set coins = c.coins + e.coins
    from public.cup_entries e
   where e.cup_id = p_cup and e.club_id = c.id and e.coins > 0;
  return champ;
end $$;
revoke all on function public.close_cup(bigint, smallint[]) from public, anon, authenticated;
grant execute on function public.close_cup(bigint, smallint[]) to service_role;

/* ------------------------------------------------------------- RLS */

alter table public.cups enable row level security;
alter table public.cup_entries enable row level security;
alter table public.cup_changes enable row level security;
drop policy if exists "cups: leitura" on public.cups;
create policy "cups: leitura" on public.cups for select to authenticated using (true);
drop policy if exists "cup_entries: leitura" on public.cup_entries;
create policy "cup_entries: leitura" on public.cup_entries for select to authenticated using (true);
drop policy if exists "cup_changes: leitura" on public.cup_changes;
create policy "cup_changes: leitura" on public.cup_changes for select to authenticated using (true);
drop policy if exists "cup_changes: técnico do clube" on public.cup_changes;
create policy "cup_changes: técnico do clube" on public.cup_changes for insert to authenticated
  with check (club_id = (select auth.uid()) and public.cup_change_ok(cup_id, round, club_id, tick));

revoke all on public.cups, public.cup_entries, public.cup_changes from anon, authenticated;
grant select on public.cups, public.cup_entries, public.cup_changes to authenticated;
grant insert (cup_id, round, club_id, tick, change) on public.cup_changes to authenticated;
