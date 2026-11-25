-- =====================================================================
-- Prancheta — Evolução das cartas
--
-- clubs.xp: XP acumulado de cada uma das 14 cartas do elenco (null = zero).
-- Só muda no fechamento da temporada, dentro de close_league():
--   XP dos jogos (calculado pela Edge Function com o motor do jogo, p_xp)
--   + bônus de fim de temporada: acesso +40, título +60 (lib/cards/evolution.ts).
-- O nível e o overall são derivados do XP no aparelho — o banco não guarda.
-- =====================================================================

alter table public.clubs add column if not exists xp smallint[]
  check (xp is null or (cardinality(xp) = 14 and 0 <= all (xp)));

drop function if exists public.close_league(bigint, text, smallint[]);

-- p_xp: { "<club_id>": [14 inteiros] } — XP dos jogos de cada clube humano na temporada
create or replace function public.close_league(p_league bigint, p_final text, p_points smallint[], p_xp jsonb default '{}'::jsonb)
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
  if jsonb_typeof(coalesce(p_xp, '{}'::jsonb)) <> 'object' then
    raise exception 'xp inválido' using errcode = '22023';
  end if;

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

  -- XP: jogos (limitado a 3000 por carta) + bônus de acesso/título
  update public.clubs c
     set xp = (
       select array_agg(
                least(32000,
                  coalesce(c.xp[k], 0)
                  + least(3000, greatest(0, coalesce((p_xp -> c.id::text ->> (k - 1))::int, 0)))
                  + s.bonus
                )::smallint order by k)
         from generate_series(1, 14) k)
    from (select club_id,
                 (case when move > 0 then 40 else 0 end) + (case when pos = 1 then 60 else 0 end) as bonus
            from public.club_seasons where league_id = lg.id) s
   where s.club_id = c.id and c.league_id = lg.id;

  update public.clubs c
     set division = c.division + s.move
    from public.club_seasons s
   where s.league_id = lg.id and s.club_id = c.id and s.move <> 0 and c.division = lg.division;

  return p_final;
end $$;
revoke all on function public.close_league(bigint, text, smallint[], jsonb) from public, anon, authenticated;
grant execute on function public.close_league(bigint, text, smallint[], jsonb) to service_role;
-- xp não tem grant de update: só o fechamento da temporada mexe
