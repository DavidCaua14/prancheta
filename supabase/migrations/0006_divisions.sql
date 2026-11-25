-- =====================================================================
-- Prancheta — Divisões e fim de temporada (acesso à Série D)
--
-- Quem fecha a temporada é a Edge Function `close-league`: ela recalcula
-- todos os jogos com o mesmo motor do jogo e chama close_league() com a
-- ordem final das vagas. Só a service_role executa close_league().
--
-- Guardamos por clube só UMA linha por temporada (club_seasons) e, na liga,
-- a ordem final (10 caracteres). Nada de placares.
-- =====================================================================

alter table public.clubs add column if not exists division smallint not null default 0
  check (division between 0 and 5);

alter table public.leagues add column if not exists closed_at timestamptz;
alter table public.leagues add column if not exists final text
  check (final ~ '^[0-9a-j]{4,20}$');

create index if not exists leagues_open_division on public.leagues (division, ends_at) where closed_at is null;

/* Regras de cada divisão (espelho de lib/league/divisions.ts).
   up = quantos sobem, down = quantos caem. Série C ainda não existe: ninguém sobe da D. */
create or replace function public.division_rules(p_division smallint, out up smallint, out down smallint)
language sql immutable as $$
  select case p_division when 0 then 4 else 0 end::smallint,
         case p_division when 1 then 3 else 0 end::smallint
$$;

create table if not exists public.club_seasons (
  club_id   uuid not null references public.clubs (id) on delete cascade,
  league_id bigint not null references public.leagues (id) on delete cascade,
  division  smallint not null,
  pos       smallint not null,
  pts       smallint not null,
  move      smallint not null default 0 check (move between -1 and 1),
  primary key (club_id, league_id)
);

/* -------------------------------------------- fechar a temporada */

-- p_final: ordem final das vagas em base 36 (1º colocado primeiro)
-- p_points: pontos de cada vaga (índice = vaga)
create or replace function public.close_league(p_league bigint, p_final text, p_points smallint[])
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

  -- a ordem precisa ser uma permutação das vagas 0..size-1
  if length(p_final) <> lg.size or coalesce(array_length(p_points, 1), 0) <> lg.size then
    raise exception 'resultado inválido' using errcode = '22023';
  end if;
  for i in 0..lg.size - 1 loop
    if position(substr('0123456789abcdefghij', i + 1, 1) in p_final) = 0 then
      raise exception 'resultado inválido' using errcode = '22023';
    end if;
  end loop;

  select * into rules from public.division_rules(lg.division);
  update public.leagues set closed_at = now(), final = p_final where id = p_league;

  insert into public.club_seasons (club_id, league_id, division, pos, pts, move)
  select c.id, lg.id, lg.division, p.pos, p_points[c.league_slot + 1],
         case
           when c.division <> lg.division then 0
           when rules.up > 0 and p.pos <= rules.up then 1
           when rules.down > 0 and p.pos > lg.size - rules.down then -1
           else 0
         end
    from public.clubs c
    cross join lateral (select position(substr('0123456789abcdefghij', c.league_slot + 1, 1) in p_final)::smallint as pos) p
   where c.league_id = lg.id
  on conflict do nothing;

  update public.clubs c
     set division = c.division + s.move
    from public.club_seasons s
   where s.league_id = lg.id and s.club_id = c.id and s.move <> 0 and c.division = lg.division;

  return p_final;
end $$;
revoke all on function public.close_league(bigint, text, smallint[]) from public, anon, authenticated;
grant execute on function public.close_league(bigint, text, smallint[]) to service_role;

/* --------------------------------------- entrar na liga da divisão */

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

/* ------------------------------------------------------------- RLS */

alter table public.club_seasons enable row level security;
drop policy if exists "club_seasons: leitura" on public.club_seasons;
create policy "club_seasons: leitura" on public.club_seasons for select to authenticated using (true);
revoke all on public.club_seasons from anon, authenticated;
grant select on public.club_seasons to authenticated;
-- division e o fim de temporada só mudam pelas funções acima (sem grant de update)
