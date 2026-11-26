-- =====================================================================
-- Prancheta — Copa das Lendas (cups.kind = 3)
--
-- A copa da elite: só clubes da Liga das Lendas (division = 5). Semanal,
-- todo sábado: 32 clubes, fases às 12h30, 14h30, 16h30, 18h30 e 20h30
-- (Brasília) — horários livres da liga (horas pares) e das outras copas.
-- Inscrição até 12h15 de sábado. CPU no nível das Lendas.
-- Prêmios: 50 (1ª fase) · 100 · 150 · 250 · vice 500 · campeão 1.000.
-- Espelho de CUP_KINDS em lib/cup/core.ts.
-- =====================================================================

drop function if exists public.cup_config(smallint);
create or replace function public.cup_config(p_kind smallint,
  out size smallint, out first_at time, out deadline time, out min_division smallint,
  out weekday smallint, out requires_title boolean)
language sql immutable as $$
  select case p_kind when 1 then 64 when 2 then 16 else 32 end::smallint,
         case p_kind when 1 then time '11:30' when 2 then time '14:30' when 3 then time '12:30' else time '13:00' end,
         case p_kind when 1 then time '11:15' when 2 then time '14:15' when 3 then time '12:15' else time '12:45' end,
         case p_kind when 1 then 2 when 3 then 5 else 0 end::smallint,
         case p_kind when 2 then 0 when 3 then 6 else null end::smallint,
         p_kind = 2
$$;

create or replace function public.cup_prize(p_kind smallint, p_reach smallint) returns integer
language sql immutable as $$
  select case p_kind
    when 1 then (array[0, 20, 40, 80, 150, 300, 500])[least(greatest(p_reach, 0), 6) + 1]
    when 2 then (array[100, 150, 250, 400, 800])[least(greatest(p_reach, 0), 4) + 1]
    when 3 then (array[50, 100, 150, 250, 500, 1000])[least(greatest(p_reach, 0), 5) + 1]
    else (array[0, 20, 40, 80, 150, 300])[least(greatest(p_reach, 0), 5) + 1]
  end
$$;

create or replace function public.join_cup(p_kind smallint default 0) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  my public.clubs;
  cfg record;
  cid bigint;
  loc timestamp := now() at time zone 'America/Sao_Paulo';
  ahead int;
  day date;
  start_at timestamptz;
  rounds int;
  cp public.cups;
  free_slot int;
  attempt int := 0;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if p_kind not in (0, 1, 2, 3) then raise exception 'copa indisponível' using errcode = '22023'; end if;
  select * into cfg from public.cup_config(p_kind);
  select * into my from public.clubs where id = uid;
  if not found or my.squad is null then raise exception 'monte o elenco antes' using errcode = 'P0001'; end if;
  if my.division < cfg.min_division then
    raise exception 'copa liberada a partir da divisão %', cfg.min_division using errcode = 'P0009';
  end if;
  if cfg.requires_title and not exists (
    select 1 from public.club_seasons s join public.leagues l on l.id = s.league_id
     where s.club_id = uid and s.pos = 1 and l.closed_at > now() - interval '7 days'
  ) then
    raise exception 'só para campeões de divisão' using errcode = 'P0010';
  end if;

  -- já inscrito numa edição que ainda não acabou: fica nela
  select c.id into cid
    from public.cup_entries e join public.cups c on c.id = e.cup_id
   where e.club_id = uid and c.kind = p_kind and c.ends_at > now()
   order by c.id desc limit 1;
  if found then return cid; end if;

  -- próxima edição: hoje (antes do prazo) ou o próximo dia válido
  ahead := case when loc::time < cfg.deadline then 0 else 1 end;
  if cfg.weekday is not null then
    ahead := (cfg.weekday - extract(dow from loc)::int + 7) % 7;
    if ahead = 0 and loc::time >= cfg.deadline then ahead := 7; end if;
  end if;
  day := loc::date + ahead;
  start_at := (day + cfg.first_at) at time zone 'America/Sao_Paulo';
  rounds := round(log(2, cfg.size))::int;

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
      values (p_kind, cfg.size, start_at, start_at + make_interval(hours => (rounds - 1) * 2) + interval '15 minutes')
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
