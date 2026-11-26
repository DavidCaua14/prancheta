-- =====================================================================
-- Prancheta — Amistosos entre amigos
--
-- O técnico marca um horário e recebe um código (ex.: RESENHA-7K2Q). O link
-- com o código vai para o grupo; o amigo abre, aceita e o jogo acontece ao
-- vivo no horário, com a mesma tela da liga (tática e substituições).
--
-- Leve no banco: 1 linha por amistoso + as mudanças ao vivo. Placar e
-- narração são calculados no aparelho (lib/friendly/core.ts), como na liga.
-- Amistoso não dá moedas, XP nem conta nos eventos (nada para "farmar").
--
-- Força congelada no aceite (XP das cartas dos dois clubes), como nas copas.
-- Os convites só são lidos pelo código (RPC friendly_invite): a tabela só
-- mostra a cada clube os seus próprios amistosos.
-- =====================================================================

create table if not exists public.friendlies (
  id          bigint generated always as identity primary key,
  code        text not null unique check (code ~ '^[A-Z]{4,9}-[0-9A-Z]{4}$'),
  host        uuid not null references public.clubs (id) on delete cascade,
  guest       uuid references public.clubs (id) on delete cascade,
  kickoff     timestamptz not null,
  host_xp     smallint[],
  guest_xp    smallint[],
  accepted_at timestamptz,
  created_at  timestamptz not null default now(),
  check (guest is null or guest <> host)
);
create index if not exists friendlies_host on public.friendlies (host, kickoff desc);
create index if not exists friendlies_guest on public.friendlies (guest, kickoff desc) where guest is not null;

create table if not exists public.friendly_changes (
  friendly_id bigint not null references public.friendlies (id) on delete cascade,
  club_id     uuid not null references public.clubs (id) on delete cascade,
  tick        smallint not null check (tick between 1 and 100),
  change      text not null check (change ~ '^(p[0-4]|m[0-2]|s[0-2]|l[0-2]|w[0-2]|t[0-2]|x[0-9a-z]{2}|y[0-9a-z]{4})$'),
  created_at  timestamptz not null default now(),
  primary key (friendly_id, club_id, tick, change)
);

/* ------------------------------------------------------- marcar */

-- Cria o convite. Horário: de 2 min a 7 dias à frente (arredondado ao minuto).
-- Até 5 amistosos por clube ainda por jogar (marcados por ele ou aceitos).
create or replace function public.create_friendly(p_kickoff timestamptz) returns text
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  k timestamptz := date_trunc('minute', p_kickoff);
  words text[] := array['RESENHA', 'PELADA', 'CLASSICO', 'GOLACO', 'CANETA', 'CHAPEU', 'LAMBRETA',
                        'TRIVELA', 'PEDALADA', 'TABELA', 'VARZEA', 'DERBI', 'BICICLETA', 'RABONA',
                        'CAVADINHA', 'FOLHASECA', 'ELASTICO', 'DRIBLE', 'PENEIRA', 'ZAGUEIRO'];
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  c text;
  attempt int := 0;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if not exists (select 1 from public.clubs where id = uid and squad is not null) then
    raise exception 'monte o elenco antes' using errcode = 'P0001';
  end if;
  if k < now() + interval '2 minutes' or k > now() + interval '7 days' then
    raise exception 'horário inválido' using errcode = '22023';
  end if;
  -- faxina: convites meus que ninguém aceitou e já passaram; amistosos com mais de 30 dias
  delete from public.friendlies f where f.host = uid and f.guest is null and f.kickoff < now();
  delete from public.friendlies f where (f.host = uid or f.guest = uid) and f.kickoff < now() - interval '30 days';
  if (select count(*) from public.friendlies f where (f.host = uid or f.guest = uid) and f.kickoff > now() - interval '15 minutes') >= 5 then
    raise exception 'limite de amistosos marcados' using errcode = 'P0011';
  end if;
  loop
    attempt := attempt + 1;
    c := words[1 + floor(random() * array_length(words, 1))::int] || '-' ||
         (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 4));
    begin
      insert into public.friendlies (code, host, kickoff) values (c, uid, k);
      return c;
    exception when unique_violation then
      if attempt >= 8 then raise; end if;
    end;
  end loop;
end $$;

/* -------------------------------------------------- ver o convite */

-- Quem tem o código vê o convite (quem marcou, horário, se já foi aceito).
create or replace function public.friendly_invite(p_code text)
returns table (id bigint, kickoff timestamptz, host uuid, host_name text, host_tag text, host_crest text,
               guest uuid, guest_name text, guest_tag text)
language sql stable security definer set search_path = public as $$
  select f.id, f.kickoff, f.host, h.name, h.tag, h.crest, f.guest, g.name, g.tag
    from public.friendlies f
    join public.clubs h on h.id = f.host
    left join public.clubs g on g.id = f.guest
   where f.code = upper(btrim(p_code))
$$;

/* --------------------------------------------------------- aceitar */

-- Aceita o convite até 30 s antes do apito. Congela o XP dos dois clubes.
create or replace function public.accept_friendly(p_code text) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  f public.friendlies;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if not exists (select 1 from public.clubs where id = uid and squad is not null) then
    raise exception 'monte o elenco antes' using errcode = 'P0001';
  end if;
  select * into f from public.friendlies where code = upper(btrim(p_code)) for update;
  if not found then raise exception 'convite não encontrado' using errcode = 'P0002'; end if;
  if f.guest = uid then return f.id; end if;
  if f.host = uid then raise exception 'o convite é seu' using errcode = 'P0012'; end if;
  if f.guest is not null then raise exception 'convite já aceito' using errcode = 'P0013'; end if;
  if f.kickoff < now() + interval '30 seconds' then raise exception 'convite expirado' using errcode = 'P0014'; end if;
  if (select count(*) from public.friendlies x where (x.host = uid or x.guest = uid) and x.kickoff > now() - interval '15 minutes') >= 5 then
    raise exception 'limite de amistosos marcados' using errcode = 'P0011';
  end if;
  update public.friendlies x
     set guest = uid, accepted_at = now(),
         host_xp = (select c.xp from public.clubs c where c.id = f.host),
         guest_xp = (select c.xp from public.clubs c where c.id = uid)
   where x.id = f.id;
  return f.id;
end $$;

/* -------------------------------------------------------- cancelar */

-- Quem marcou cancela (antes do apito); quem aceitou desiste (o convite volta a ficar livre).
create or replace function public.leave_friendly(p_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  delete from public.friendlies f where f.id = p_id and f.host = uid and f.kickoff > now();
  if found then return; end if;
  update public.friendlies f
     set guest = null, accepted_at = null, host_xp = null, guest_xp = null
   where f.id = p_id and f.guest = uid and f.kickoff > now();
end $$;

/* ------------------------------------------- mudanças durante o jogo */

create or replace function public.friendly_change_ok(p_id bigint, p_club uuid, p_tick smallint)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.friendlies f
     where f.id = p_id and f.guest is not null and (f.host = p_club or f.guest = p_club)
       and f.kickoff + make_interval(secs => p_tick * 6) > now() + interval '3 seconds'
       and f.kickoff <= now() + interval '2 hours'
  )
  and (select count(*) from public.friendly_changes m where m.friendly_id = p_id and m.club_id = p_club) < 30
$$;

/* ------------------------------------------------------------- RLS */

alter table public.friendlies enable row level security;
alter table public.friendly_changes enable row level security;
drop policy if exists "friendlies: os meus" on public.friendlies;
create policy "friendlies: os meus" on public.friendlies for select to authenticated
  using (host = (select auth.uid()) or guest = (select auth.uid()));
drop policy if exists "friendly_changes: participantes" on public.friendly_changes;
create policy "friendly_changes: participantes" on public.friendly_changes for select to authenticated
  using (exists (select 1 from public.friendlies f where f.id = friendly_id and (f.host = (select auth.uid()) or f.guest = (select auth.uid()))));
drop policy if exists "friendly_changes: técnico do clube" on public.friendly_changes;
create policy "friendly_changes: técnico do clube" on public.friendly_changes for insert to authenticated
  with check (club_id = (select auth.uid()) and public.friendly_change_ok(friendly_id, club_id, tick));

revoke all on public.friendlies, public.friendly_changes from anon, authenticated;
grant select on public.friendlies, public.friendly_changes to authenticated;
grant insert (friendly_id, club_id, tick, change) on public.friendly_changes to authenticated;

revoke all on function public.create_friendly(timestamptz) from public, anon;
revoke all on function public.friendly_invite(text) from public, anon;
revoke all on function public.accept_friendly(text) from public, anon;
revoke all on function public.leave_friendly(bigint) from public, anon;
revoke all on function public.friendly_change_ok(bigint, uuid, smallint) from public, anon;
grant execute on function public.create_friendly(timestamptz) to authenticated;
grant execute on function public.friendly_invite(text) to authenticated;
grant execute on function public.accept_friendly(text) to authenticated;
grant execute on function public.leave_friendly(bigint) to authenticated;
grant execute on function public.friendly_change_ok(bigint, uuid, smallint) to authenticated;
