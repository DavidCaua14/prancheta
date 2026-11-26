-- =====================================================================
-- Prancheta — painel administrativo (/admin)
--
-- Quem é admin: e-mails em admin_emails (tabela sem acesso pelo app; o
-- e-mail é cadastrado direto no banco, NÃO nesta migração). Vale para a conta
-- com esse e-mail confirmado — mesmo que ela ainda não exista.
--
-- Presença: o app chama ping(tela) a cada minuto com a aba visível. Guarda só
-- a última vez visto (uma linha por usuário) e os dias de uso (uma linha por
-- usuário/dia) — online agora, ativos por dia, retenção.
--
-- Todas as funções admin_* conferem is_admin() e gravam as ações em admin_log.
-- =====================================================================

create table if not exists public.admin_emails (email text primary key check (email = lower(email)));
alter table public.admin_emails enable row level security;
revoke all on public.admin_emails from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from auth.users u join public.admin_emails a on a.email = lower(u.email)
     where u.id = auth.uid() and u.email_confirmed_at is not null
  )
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create or replace function public.assert_admin() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'acesso restrito' using errcode = '42501'; end if;
end $$;
revoke all on function public.assert_admin() from public, anon, authenticated;

/* ------------------------------------------------------------ presença */

create table if not exists public.presence (
  user_id   uuid primary key references auth.users (id) on delete cascade,
  last_seen timestamptz not null default now(),
  screen    text
);
create index if not exists presence_recent on public.presence (last_seen desc);
alter table public.presence enable row level security;
revoke all on public.presence from anon, authenticated;

create table if not exists public.activity_days (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  primary key (day, user_id)
);
alter table public.activity_days enable row level security;
revoke all on public.activity_days from anon, authenticated;

create or replace function public.ping(p_screen text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  insert into public.presence (user_id, last_seen, screen) values (uid, now(), left(p_screen, 40))
  on conflict (user_id) do update set last_seen = excluded.last_seen, screen = excluded.screen;
  insert into public.activity_days (user_id, day) values (uid, (now() at time zone 'America/Sao_Paulo')::date)
  on conflict do nothing;
end $$;
revoke all on function public.ping(text) from public, anon;
grant execute on function public.ping(text) to authenticated;

/* ------------------------------------------------------------- registro */

create table if not exists public.admin_log (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  admin  uuid references auth.users (id) on delete set null,
  action text not null,
  target uuid,
  detail jsonb
);
alter table public.admin_log enable row level security;
revoke all on public.admin_log from anon, authenticated;

/* ----------------------------------------------------------- visão geral */

create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
  res jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object(
    'now', now(),
    'users', jsonb_build_object(
      'total',     (select count(*) from auth.users),
      'new_24h',   (select count(*) from auth.users where created_at > now() - interval '24 hours'),
      'new_7d',    (select count(*) from auth.users where created_at > now() - interval '7 days'),
      'no_club',   (select count(*) from auth.users u where not exists (select 1 from public.clubs c where c.id = u.id)),
      'no_squad',  (select count(*) from public.clubs where squad is null),
      'online',    (select count(*) from public.presence where last_seen > now() - interval '2 minutes'),
      'active_1d', (select count(*) from public.activity_days where day = today),
      'active_7d', (select count(distinct user_id) from public.activity_days where day > today - 7),
      'active_30d',(select count(distinct user_id) from public.activity_days where day > today - 30)
    ),
    'series', (
      select jsonb_agg(jsonb_build_object(
               'day', d::date,
               'signups', (select count(*) from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date = d::date),
               'active',  (select count(*) from public.activity_days a where a.day = d::date)
             ) order by d)
        from generate_series(today - 13, today, interval '1 day') d
    ),
    'divisions', coalesce((
      select jsonb_agg(jsonb_build_object('division', division, 'clubs', n, 'coins', coins) order by division)
        from (select division, count(*) n, sum(coins) coins from public.clubs where squad is not null group by division) x), '[]'::jsonb),
    'economy', jsonb_build_object(
      'coins_total',   (select coalesce(sum(coins), 0) from public.clubs),
      'coins_avg',     (select coalesce(round(avg(coins)), 0) from public.clubs where squad is not null),
      'coins_max',     (select coalesce(max(coins), 0) from public.clubs),
      'auction_24h',   (select coalesce(sum(best_amount), 0) from public.auction_lots where best_club is not null and ends_at between now() - interval '24 hours' and now()),
      'auction_sold_24h', (select count(*) from public.auction_lots where best_club is not null and ends_at between now() - interval '24 hours' and now()),
      'auction_open',  (select count(*) from public.auction_lots where ends_at > now()),
      'auction_bids_open', (select coalesce(sum(bids), 0) from public.auction_lots where ends_at > now()),
      'events_7d',     (select coalesce(sum(coins), 0) from public.event_claims where claimed_at > now() - interval '7 days'),
      'home_7d',       (select coalesce(sum(coins), 0) from public.home_income where paid_at > now() - interval '7 days'),
      'league_prizes_7d', (select coalesce(sum(s.coins), 0) from public.club_seasons s join public.leagues l on l.id = s.league_id where l.closed_at > now() - interval '7 days'),
      'cup_prizes_7d', (select coalesce(sum(e.coins), 0) from public.cup_entries e join public.cups c on c.id = e.cup_id where c.closed_at > now() - interval '7 days'),
      'facilities',    (select jsonb_build_array(coalesce(sum(facilities[1]), 0), coalesce(sum(facilities[2]), 0), coalesce(sum(facilities[3]), 0)) from public.clubs)
    ),
    'play', jsonb_build_object(
      'leagues_open',  (select count(*) from public.leagues where closed_at is null),
      'cups_open',     (select count(*) from public.cups where closed_at is null),
      'matches_24h',   (select count(*) from public.match_points where played_at > now() - interval '24 hours'),
      'changes_24h',   (select (select count(*) from public.match_changes where created_at > now() - interval '24 hours')
                             + (select count(*) from public.cup_changes where created_at > now() - interval '24 hours')),
      'lineups_24h',   (select count(*) from public.lineup_log where at > now() - interval '24 hours'),
      'friendlies_24h',(select count(*) from public.friendlies where created_at > now() - interval '24 hours'),
      'friendlies_played_24h', (select count(*) from public.friendlies where accepted_at is not null and kickoff between now() - interval '24 hours' and now())
    ),
    'health', jsonb_build_object(
      'leagues_overdue', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'division', division, 'ends_at', ends_at))
                                     from public.leagues where closed_at is null and ends_at < now() - interval '30 minutes'), '[]'::jsonb),
      'cups_overdue',    coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'ends_at', ends_at))
                                     from public.cups where closed_at is null and ends_at < now() - interval '30 minutes'), '[]'::jsonb),
      'unscored_rounds', (select count(*) from public.league_rounds r join public.leagues l on l.id = r.league_id
                           where r.kickoff between now() - interval '2 days' and now() - interval '20 minutes'
                             and exists (select 1 from public.clubs c where c.league_id = l.id)
                             and not exists (select 1 from public.scored_rounds s where s.kind = 0 and s.ref_id = r.league_id and s.round = r.round)),
      'db_size',         pg_database_size(current_database())
    )
  ) into res;
  return res;
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

/* ---------------------------------------------------------------- online */

create or replace function public.admin_online() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', p.user_id, 'email', u.email, 'last_seen', p.last_seen, 'screen', p.screen,
             'name', c.name, 'tag', c.tag, 'crest', c.crest, 'division', c.division, 'coins', c.coins)
           order by p.last_seen desc)
      from public.presence p join auth.users u on u.id = p.user_id left join public.clubs c on c.id = p.user_id
     where p.last_seen > now() - interval '15 minutes'), '[]'::jsonb);
end $$;
revoke all on function public.admin_online() from public, anon;
grant execute on function public.admin_online() to authenticated;

/* -------------------------------------------------------------- usuários */

create or replace function public.admin_users(p_q text default null, p_sort text default 'recent', p_limit int default 50, p_offset int default 0) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  q text := nullif(trim(lower(p_q)), '');
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'total', (select count(*) from auth.users u left join public.clubs c on c.id = u.id
               where q is null or lower(u.email) like '%' || q || '%' or lower(c.name) like '%' || q || '%' or lower(c.tag) = q),
    'rows', coalesce((
      select jsonb_agg(r order by ord) from (
        select jsonb_build_object(
                 'id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                 'provider', u.raw_app_meta_data->>'provider', 'banned', u.banned_until is not null and u.banned_until > now(),
                 'name', c.name, 'tag', c.tag, 'crest', c.crest, 'division', c.division, 'coins', c.coins,
                 'has_squad', c.squad is not null, 'league_id', c.league_id,
                 'last_seen', p.last_seen, 'days', (select count(*) from public.activity_days a where a.user_id = u.id)) as r,
               row_number() over (order by
                 case when p_sort = 'coins' then -coalesce(c.coins, -1) end,
                 case when p_sort = 'division' then -coalesce(c.division, -1) end,
                 case when p_sort = 'seen' then p.last_seen end desc nulls last,
                 u.created_at desc) as ord
          from auth.users u left join public.clubs c on c.id = u.id left join public.presence p on p.user_id = u.id
         where q is null or lower(u.email) like '%' || q || '%' or lower(c.name) like '%' || q || '%' or lower(c.tag) = q
         order by ord
         limit least(p_limit, 200) offset p_offset
      ) x), '[]'::jsonb)
  );
end $$;
revoke all on function public.admin_users(text, text, int, int) from public, anon;
grant execute on function public.admin_users(text, text, int, int) to authenticated;

create or replace function public.admin_user(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return (
    select jsonb_build_object(
      'auth', jsonb_build_object('id', u.id, 'email', u.email, 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at,
                                 'confirmed', u.email_confirmed_at is not null, 'provider', u.raw_app_meta_data->>'provider'),
      'admin', exists (select 1 from public.admin_emails a where a.email = lower(u.email)),
      'presence', (select jsonb_build_object('last_seen', p.last_seen, 'screen', p.screen) from public.presence p where p.user_id = u.id),
      'days', (select count(*) from public.activity_days a where a.user_id = u.id),
      'club', (select jsonb_build_object('name', c.name, 'tag', c.tag, 'crest', c.crest, 'kit', c.kit, 'created_at', c.created_at,
                                         'division', c.division, 'coins', c.coins, 'facilities', c.facilities, 'has_squad', c.squad is not null,
                                         'league_id', c.league_id, 'league_slot', c.league_slot, 'xp_total', (select coalesce(sum(x), 0) from unnest(c.xp) x))
                 from public.clubs c where c.id = u.id),
      'seasons', coalesce((select jsonb_agg(jsonb_build_object('league_id', s.league_id, 'division', s.division, 'pos', s.pos, 'pts', s.pts, 'move', s.move,
                                                               'coins', s.coins, 'wins', s.wins, 'draws', s.draws, 'games', s.games) order by s.league_id desc)
                             from (select * from public.club_seasons where club_id = u.id order by league_id desc limit 10) s), '[]'::jsonb),
      'cups', coalesce((select jsonb_agg(jsonb_build_object('cup_id', e.cup_id, 'kind', c.kind, 'reach', e.reach, 'coins', e.coins, 'starts_at', c.starts_at) order by e.cup_id desc)
                          from (select * from public.cup_entries where club_id = u.id order by cup_id desc limit 10) e join public.cups c on c.id = e.cup_id), '[]'::jsonb),
      'auction', jsonb_build_object(
        'won', (select count(*) from public.auction_lots where best_club = u.id and ends_at < now()),
        'spent', (select coalesce(sum(best_amount), 0) from public.auction_lots where best_club = u.id and ends_at < now()),
        'leading', (select count(*) from public.auction_lots where best_club = u.id and ends_at > now())),
      'matches', jsonb_build_object(
        'total', (select count(*) from public.match_points where club_id = u.id),
        'wins', (select count(*) from public.match_points where club_id = u.id and kind = 0 and result = 2),
        'last', (select max(played_at) from public.match_points where club_id = u.id)),
      'events_coins', (select coalesce(sum(coins), 0) from public.event_claims where club_id = u.id),
      'home_coins', (select coalesce(sum(coins), 0) from public.home_income where club_id = u.id),
      'log', coalesce((select jsonb_agg(jsonb_build_object('at', l.at, 'action', l.action, 'detail', l.detail) order by l.at desc)
                         from (select * from public.admin_log where target = u.id order by at desc limit 20) l), '[]'::jsonb)
    )
    from auth.users u where u.id = p_id
  );
end $$;
revoke all on function public.admin_user(uuid) from public, anon;
grant execute on function public.admin_user(uuid) to authenticated;

/* ---------------------------------------------------------- competições */

create or replace function public.admin_competitions() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return jsonb_build_object(
    'leagues', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', l.id, 'division', l.division, 'size', l.size, 'rounds', l.rounds, 'starts_at', l.starts_at, 'ends_at', l.ends_at,
               'closed_at', l.closed_at,
               'humans', (select count(*) from public.clubs c where c.league_id = l.id),
               'played', (select count(*) from public.league_rounds r where r.league_id = l.id and r.kickoff <= now()),
               'next', (select min(kickoff) from public.league_rounds r where r.league_id = l.id and r.kickoff > now()))
             order by l.closed_at nulls first, l.division desc, l.id desc)
        from (select * from public.leagues where closed_at is null or closed_at > now() - interval '3 days' order by id desc limit 100) l), '[]'::jsonb),
    'cups', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', c.id, 'kind', c.kind, 'size', c.size, 'starts_at', c.starts_at, 'ends_at', c.ends_at, 'closed_at', c.closed_at,
               'entries', (select count(*) from public.cup_entries e where e.cup_id = c.id),
               'champion', (select jsonb_build_object('name', k.name, 'tag', k.tag) from public.cup_entries e join public.clubs k on k.id = e.club_id
                             where e.cup_id = c.id and e.slot = c.champion))
             order by c.starts_at desc)
        from (select * from public.cups order by starts_at desc limit 40) c), '[]'::jsonb),
    'auction', coalesce((
      select jsonb_agg(jsonb_build_object('round', a.round, 'idx', a.idx, 'ends_at', a.ends_at, 'bids', a.bids, 'amount', a.best_amount,
                                          'name', k.name, 'tag', k.tag) order by a.ends_at desc)
        from (select * from public.auction_lots where ends_at > now() - interval '24 hours' order by ends_at desc limit 60) a
        left join public.clubs k on k.id = a.best_club), '[]'::jsonb)
  );
end $$;
revoke all on function public.admin_competitions() from public, anon;
grant execute on function public.admin_competitions() to authenticated;

/* ---------------------------------------------------------------- ações */

-- dá (ou tira, com valor negativo) moedas de um clube; nunca deixa negativo
create or replace function public.admin_grant_coins(p_club uuid, p_amount int, p_reason text) returns int
language plpgsql security definer set search_path = public as $$
declare
  got int;
begin
  perform public.assert_admin();
  if p_amount = 0 or abs(p_amount) > 1000000 then raise exception 'valor inválido' using errcode = '22023'; end if;
  if coalesce(trim(p_reason), '') = '' then raise exception 'informe o motivo' using errcode = '22023'; end if;
  update public.clubs set coins = greatest(0, coins + p_amount) where id = p_club returning coins into got;
  if not found then raise exception 'clube não encontrado' using errcode = 'P0002'; end if;
  insert into public.admin_log (admin, action, target, detail)
  values (auth.uid(), 'moedas', p_club, jsonb_build_object('amount', p_amount, 'reason', left(p_reason, 200), 'coins', got));
  return got;
end $$;
revoke all on function public.admin_grant_coins(uuid, int, text) from public, anon;
grant execute on function public.admin_grant_coins(uuid, int, text) to authenticated;

-- troca o nome/sigla de um clube (nome ofensivo, por exemplo)
create or replace function public.admin_rename_club(p_club uuid, p_name text, p_tag text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  old jsonb;
begin
  perform public.assert_admin();
  select jsonb_build_object('name', name, 'tag', tag) into old from public.clubs where id = p_club for update;
  if not found then raise exception 'clube não encontrado' using errcode = 'P0002'; end if;
  update public.clubs set name = trim(p_name), tag = upper(trim(p_tag)) where id = p_club;
  insert into public.admin_log (admin, action, target, detail)
  values (auth.uid(), 'renomear', p_club, jsonb_build_object('from', old, 'to', jsonb_build_object('name', trim(p_name), 'tag', upper(trim(p_tag))), 'reason', left(p_reason, 200)));
end $$;
revoke all on function public.admin_rename_club(uuid, text, text, text) from public, anon;
grant execute on function public.admin_rename_club(uuid, text, text, text) to authenticated;

-- bloqueia/desbloqueia a conta (não consegue mais entrar; a sessão atual expira em até 1 h)
create or replace function public.admin_ban(p_user uuid, p_ban boolean, p_reason text) returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  perform public.assert_admin();
  if p_user = auth.uid() then raise exception 'não dá para bloquear a si mesmo' using errcode = '22023'; end if;
  if p_ban and exists (select 1 from auth.users u join public.admin_emails a on a.email = lower(u.email) where u.id = p_user) then
    raise exception 'não dá para bloquear um admin' using errcode = '22023';
  end if;
  update auth.users set banned_until = case when p_ban then 'infinity'::timestamptz else null end where id = p_user;
  if not found then raise exception 'usuário não encontrado' using errcode = 'P0002'; end if;
  if p_ban then
    delete from auth.sessions where user_id = p_user;
    delete from auth.refresh_tokens where user_id = p_user::text;
  end if;
  insert into public.admin_log (admin, action, target, detail)
  values (auth.uid(), case when p_ban then 'bloquear' else 'desbloquear' end, p_user, jsonb_build_object('reason', left(p_reason, 200)));
end $$;
revoke all on function public.admin_ban(uuid, boolean, text) from public, anon;
grant execute on function public.admin_ban(uuid, boolean, text) to authenticated;

-- registra no log uma ação feita pelo app (ex.: fechar liga atrasada pela Edge Function)
create or replace function public.admin_note(p_action text, p_detail jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  insert into public.admin_log (admin, action, detail) values (auth.uid(), left(p_action, 40), p_detail);
end $$;
revoke all on function public.admin_note(text, jsonb) from public, anon;
grant execute on function public.admin_note(text, jsonb) to authenticated;

create or replace function public.admin_log_list(p_limit int default 100) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.assert_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', l.id, 'at', l.at, 'action', l.action, 'detail', l.detail, 'admin', ua.email,
                                        'target', l.target, 'target_name', c.name, 'target_email', ut.email) order by l.id desc)
      from (select * from public.admin_log order by id desc limit least(p_limit, 500)) l
      left join auth.users ua on ua.id = l.admin
      left join auth.users ut on ut.id = l.target
      left join public.clubs c on c.id = l.target), '[]'::jsonb);
end $$;
revoke all on function public.admin_log_list(int) from public, anon;
grant execute on function public.admin_log_list(int) to authenticated;
