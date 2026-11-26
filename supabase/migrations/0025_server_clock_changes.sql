-- =====================================================================
-- Prancheta — mudanças ao vivo com o relógio do SERVIDOR
--
-- Antes, o aparelho escolhia o minuto da mudança (minuto atual + 4) pelo
-- relógio dele. Com o relógio do celular/PC atrasado ~20 s ou mais, esse
-- minuto já tinha passado para o servidor, a regra de segurança recusava e o
-- técnico via "Não deu tempo". Agora:
--   • send_changes escolhe o minuto pelo relógio do servidor (agora + 4) e
--     grava todas as mudanças de uma vez — as mesmas regras (RLS) de antes;
--   • server_now() deixa o aparelho acertar o relógio da tela.
-- =====================================================================

create or replace function public.server_now() returns timestamptz
language sql stable as $$ select now() $$;
grant execute on function public.server_now() to anon, authenticated;

-- p_scope: 'liga' (p_id = liga, p_round = rodada), 'copa' (p_id = copa, p_round = fase),
-- 'amistoso' (p_id = amistoso). Devolve o minuto em que as mudanças valem.
create or replace function public.send_changes(p_scope text, p_id bigint, p_round smallint, p_changes text[])
returns smallint
language plpgsql security invoker set search_path = public as $$
declare
  uid uuid := auth.uid();
  k timestamptz;
  t int;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  if coalesce(cardinality(p_changes), 0) not between 1 and 6 then raise exception 'mudanças inválidas' using errcode = '22023'; end if;
  if p_scope = 'liga' then
    select r.kickoff into k from public.league_rounds r where r.league_id = p_id and r.round = p_round;
  elsif p_scope = 'copa' then
    select c.starts_at + make_interval(hours => (p_round - 1) * 2) into k from public.cups c where c.id = p_id;
  elsif p_scope = 'amistoso' then
    select f.kickoff into k from public.friendlies f where f.id = p_id;
  else
    raise exception 'escopo inválido' using errcode = '22023';
  end if;
  if k is null then raise exception 'jogo não encontrado' using errcode = 'P0002'; end if;
  if now() < k then raise exception 'o jogo ainda não começou' using errcode = 'P0015'; end if;
  -- mesmo atraso de sempre: 4 minutos de jogo (24 s) para chegar a todos os aparelhos
  t := floor(extract(epoch from now() - k) / 6)::int + 4;
  -- salvou de novo o mesmo ajuste nos mesmos 6 s? vale um minuto depois (a ordem fica clara para todos)
  if p_scope = 'liga' then
    select greatest(t, coalesce(max(m.tick) + 1, t)) into t from public.match_changes m
     where m.league_id = p_id and m.round = p_round and m.club_id = uid and m.tick >= t
       and left(m.change, 1) in (select left(c, 1) from unnest(p_changes) c);
  elsif p_scope = 'copa' then
    select greatest(t, coalesce(max(m.tick) + 1, t)) into t from public.cup_changes m
     where m.cup_id = p_id and m.round = p_round and m.club_id = uid and m.tick >= t
       and left(m.change, 1) in (select left(c, 1) from unnest(p_changes) c);
  else
    select greatest(t, coalesce(max(m.tick) + 1, t)) into t from public.friendly_changes m
     where m.friendly_id = p_id and m.club_id = uid and m.tick >= t
       and left(m.change, 1) in (select left(c, 1) from unnest(p_changes) c);
  end if;
  if t > 100 then raise exception 'o jogo já acabou' using errcode = 'P0016'; end if;
  if p_scope = 'liga' then
    insert into public.match_changes (league_id, round, club_id, tick, change)
      select p_id, p_round, uid, t, c from unnest(p_changes) c;
  elsif p_scope = 'copa' then
    insert into public.cup_changes (cup_id, round, club_id, tick, change)
      select p_id, p_round, uid, t, c from unnest(p_changes) c;
  else
    insert into public.friendly_changes (friendly_id, club_id, tick, change)
      select p_id, uid, t, c from unnest(p_changes) c;
  end if;
  return t;
end $$;
revoke all on function public.send_changes(text, bigint, smallint, text[]) from public, anon;
grant execute on function public.send_changes(text, bigint, smallint, text[]) to authenticated;
