-- =====================================================================
-- Prancheta — mais formações
-- O caractere da formação passa a aceitar 0-9 e a-d (14 formações),
-- em base 36, como os índices dos jogadores.
-- =====================================================================

create or replace function public.lineup_ok(l text) returns boolean
language sql immutable as $$
  select l ~ '^1:[0-9a-d]:[0-9a-d]{11}:[0-4][0-2][0-2]:[0-9a-d]{2}$'
     and (select count(distinct c) from regexp_split_to_table(split_part(l, ':', 3), '') as c) = 11
     and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 1, 1)) > 0
     and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 2, 1)) > 0
$$;
