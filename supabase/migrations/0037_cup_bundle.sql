-- =====================================================================
-- Prancheta — tela das copas: tudo num pedido só
--
-- Antes, ao abrir: clube → minha inscrição → copa/vagas/mudanças →
-- escalações + cartas do leilão (e o último título, na Supercopa), em 4
-- etapas em sequência. Agora:
--   cup_data(p_cup)            a copa inteira (usada também no apito de cada fase)
--   cup_bundle(p_kind, p_skip) minha última inscrição + a copa (se for da
--                              edição atual ou de uma que acabou há < 12 h e o
--                              aparelho ainda não a tem: p_skip) + último título
-- security invoker: valem as regras de leitura (RLS) de cada tabela.
-- =====================================================================

create or replace function public.cup_data(p_cup bigint) returns jsonb
language sql stable security invoker set search_path = public as $$
  with cp as (
    select id, kind, size, starts_at, ends_at, closed_at, champion from public.cups where id = p_cup
  ), en as (
    select e.slot, e.club_id, e.xp, e.reach, e.coins,
           (select jsonb_build_object('name', c.name, 'tag', c.tag, 'crest', c.crest, 'kit', c.kit, 'squad', c.squad)
              from public.clubs c where c.id = e.club_id) as clubs
      from public.cup_entries e where e.cup_id = p_cup
  )
  select case when not exists (select 1 from cp) then null else jsonb_build_object(
    'cup',     (select to_jsonb(cp) from cp),
    'entries', coalesce((select jsonb_agg(to_jsonb(en)) from en), '[]'::jsonb),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('round', m.round, 'club_id', m.club_id, 'tick', m.tick, 'change', m.change))
                           from public.cup_changes m where m.cup_id = p_cup), '[]'::jsonb),
    'logs',    coalesce((select jsonb_agg(to_jsonb(g))
                           from public.lineup_log_window((select array_agg(club_id) from en), (select starts_at from cp)) g), '[]'::jsonb),
    'lots',    coalesce((select jsonb_agg(jsonb_build_object('round', a.round, 'idx', a.idx, 'ends_at', a.ends_at, 'best_club', a.best_club))
                           from public.auction_lots a where a.best_club in (select club_id from en) and a.ends_at < now()), '[]'::jsonb)
  ) end
$$;
revoke all on function public.cup_data(bigint) from public, anon;
grant execute on function public.cup_data(bigint) to authenticated;

create or replace function public.cup_bundle(p_kind smallint, p_skip bigint default null) returns jsonb
language sql stable security invoker set search_path = public as $$
  with me as (
    select e.cup_id, e.slot, e.reach, e.coins,
           jsonb_build_object('id', c.id, 'kind', c.kind, 'size', c.size, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
                              'closed_at', c.closed_at, 'champion', c.champion) as cups,
           c.ends_at
      from public.cup_entries e join public.cups c on c.id = e.cup_id
     where e.club_id = auth.uid() and c.kind = p_kind
     order by e.cup_id desc
     limit 1
  ), ti as (
    select s.division, l.closed_at
      from public.club_seasons s join public.leagues l on l.id = s.league_id
     where s.club_id = auth.uid() and s.pos = 1
     order by s.league_id desc
     limit 1
  )
  select jsonb_build_object(
    'entry', (select jsonb_build_object('cup_id', cup_id, 'slot', slot, 'reach', reach, 'coins', coins, 'cups', cups) from me),
    'data',  (select public.cup_data(me.cup_id) from me
               where me.cup_id is distinct from p_skip and now() < me.ends_at + interval '12 hours'),
    'title', (select jsonb_build_object('division', division, 'closed_at', closed_at) from ti where closed_at is not null)
  )
$$;
revoke all on function public.cup_bundle(smallint, bigint) from public, anon;
grant execute on function public.cup_bundle(smallint, bigint) to authenticated;
