-- =====================================================================
-- Prancheta — inscrições em fila (achado no teste com 50 usuários)
--
-- Com 15 técnicos se inscrevendo na copa ao mesmo tempo e nenhuma edição
-- aberta, cada um "não achava" edição e criava a sua: 8 edições com 1 clube.
-- Agora join_league (por divisão) e join_cup (por tipo de copa) pegam um
-- bloqueio curto (advisory lock) antes de escolher: um por vez, milissegundos.
-- =====================================================================

create or replace function public.join_league() returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  my public.clubs;
  cur public.leagues;
  lg public.leagues;
  free_slot int;
  started int;
  attempt int := 0;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  select * into my from public.clubs where id = uid;
  if not found then raise exception 'clube não encontrado' using errcode = 'P0002'; end if;
  if my.squad is null then raise exception 'monte o elenco antes' using errcode = 'P0001'; end if;
  -- uma entrada por vez em cada divisão: sem duas ligas novas criadas juntas, sem disputa pela última vaga
  perform pg_advisory_xact_lock(hashtext('join_league'), my.division);

  if my.league_id is not null then
    select * into cur from public.leagues where id = my.league_id;
    if found then
      if cur.ends_at > now() then return cur.id; end if;
      -- temporada acabou mas ainda não foi fechada: espera o fechamento
      -- (depois de 6 h sem fechar, libera para ninguém ficar preso)
      if cur.closed_at is null and cur.ends_at > now() - interval '6 hours' then
        raise exception 'temporada fechando' using errcode = 'P0003';
      end if;
    end if;
  end if;

  loop
    attempt := attempt + 1;
    select l.* into lg
      from public.leagues l
     where l.division = my.division
       and l.closed_at is null
       and (select count(*) from public.league_rounds r where r.league_id = l.id and r.kickoff > now()) >= 6
       and (select count(*) from public.clubs c where c.league_id = l.id) < l.size
     order by (select count(*) from public.clubs c where c.league_id = l.id) desc, l.starts_at
     limit 1
     for update;
    if not found then
      lg := public.create_league(my.division, 10::smallint);
    end if;

    select s into free_slot
      from generate_series(0, lg.size - 1) s
     where s not in (select c.league_slot from public.clubs c where c.league_id = lg.id)
     order by random()
     limit 1;
    select count(*) into started from public.league_rounds where league_id = lg.id and kickoff <= now();
    -- corrida: outro técnico pegou a última vaga enquanto esperávamos o bloqueio
    -- (o "count < size" acima usa a foto de antes) → tenta de novo, com a foto atual
    if free_slot is null then
      if attempt >= 8 then raise exception 'ligas cheias, tente de novo' using errcode = 'P0003'; end if;
      continue;
    end if;

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

  -- uma inscrição por vez em cada copa: sem duas edições novas criadas juntas
  perform pg_advisory_xact_lock(hashtext('join_cup'), p_kind);

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
    -- corrida: a última vaga foi ocupada enquanto esperávamos o bloqueio → tenta de novo
    if free_slot is null then
      if attempt >= 8 then raise exception 'copas cheias, tente de novo' using errcode = 'P0003'; end if;
      continue;
    end if;

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
