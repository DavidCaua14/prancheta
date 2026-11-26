-- =====================================================================
-- Prancheta — escalações de um período, sem perder a "última antes"
--
-- Liga, copas e amistosos precisam, para cada clube, da escalação salva
-- até o apito. Antes, os jogos liam só o lineup_log dos 11 dias antes do
-- início — mas a poda (log_lineup) guarda a última versão com mais de 10
-- dias, que pode ser bem mais antiga. Clube sem mexer na escalação há mais
-- de ~11 dias jogava com a escalação automática no lugar da salva.
--
-- lineup_log_window devolve, por clube: a última linha até p_from (o que
-- estava valendo no início) + todas as linhas depois dela (até p_to, se
-- informado). Mesmas permissões da tabela (security invoker).
-- =====================================================================

create or replace function public.lineup_log_window(p_clubs uuid[], p_from timestamptz, p_to timestamptz default null)
returns table (club_id uuid, at timestamptz, lineup text)
language sql stable security invoker set search_path = public as $$
  select l.club_id, l.at, l.lineup
    from public.lineup_log l
   where l.club_id = any (p_clubs)
     and l.at >= coalesce(
           (select max(x.at) from public.lineup_log x where x.club_id = l.club_id and x.at <= p_from),
           '-infinity'::timestamptz)
     and (p_to is null or l.at <= p_to)
   order by l.at
$$;
revoke all on function public.lineup_log_window(uuid[], timestamptz, timestamptz) from public, anon;
grant execute on function public.lineup_log_window(uuid[], timestamptz, timestamptz) to authenticated, service_role;
