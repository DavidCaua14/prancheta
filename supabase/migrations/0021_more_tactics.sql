-- =====================================================================
-- Prancheta — mais ajustes táticos (estilo Brasfoot)
--
-- Escalação ganha um trecho opcional ":LWT" no fim:
--   L linha defensiva (0 recuada, 1 normal, 2 adiantada)
--   W jogo            (0 pelo meio, 1 misto, 2 pelas pontas)
--   T ritmo           (0 cadenciado, 1 normal, 2 acelerado)
-- Sem o trecho = tudo normal (códigos antigos seguem valendo).
-- Mudanças ao vivo: l0-2, w0-2, t0-2.
-- =====================================================================

create or replace function public.lineup_ok(l text) returns boolean
language sql immutable as $$
  select case
    when l ~ '^1:[0-9a-d]:[0-9a-z]{11}:[0-4][0-2][0-2]:[0-9a-z]{2}(:[0-2]{3})?$' then
          (select count(distinct c) from regexp_split_to_table(split_part(l, ':', 3), '') as c) = 11
      and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 1, 1)) > 0
      and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 2, 1)) > 0
    when l ~ '^2:[0-9a-d]:[0-9a-z]{22}:[0-4][0-2][0-2]:[0-9a-z]{4}(:[0-2]{3})?$' then
          (select count(distinct substr(split_part(l, ':', 3), i * 2 + 1, 2)) from generate_series(0, 10) i) = 11
      and substr(split_part(l, ':', 5), 1, 2) in (select substr(split_part(l, ':', 3), i * 2 + 1, 2) from generate_series(0, 10) i)
      and substr(split_part(l, ':', 5), 3, 2) in (select substr(split_part(l, ':', 3), i * 2 + 1, 2) from generate_series(0, 10) i)
    else false
  end
$$;

alter table public.match_changes drop constraint if exists match_changes_change_check;
alter table public.match_changes add constraint match_changes_change_check
  check (change ~ '^(p[0-4]|m[0-2]|s[0-2]|l[0-2]|w[0-2]|t[0-2]|x[0-9a-z]{2}|y[0-9a-z]{4})$');

alter table public.cup_changes drop constraint if exists cup_changes_change_check;
alter table public.cup_changes add constraint cup_changes_change_check
  check (change ~ '^(p[0-4]|m[0-2]|s[0-2]|l[0-2]|w[0-2]|t[0-2]|x[0-9a-z]{2}|y[0-9a-z]{4})$');
