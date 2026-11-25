-- =====================================================================
-- Prancheta — substituição ao vivo com elenco grande
-- "xAB": sai A, entra B (1 caractere base 36: elenco até 36 cartas)
-- "yAABB": o mesmo com 2 caracteres (até 1.296 cartas — cartas do leilão)
-- Antes a liga só aceitava x[0-9a-d]{2}: carta do leilão não entrava ao vivo.
-- =====================================================================
alter table public.match_changes drop constraint if exists match_changes_change_check;
alter table public.match_changes add constraint match_changes_change_check
  check (change ~ '^(p[0-4]|m[0-2]|s[0-2]|x[0-9a-z]{2}|y[0-9a-z]{4})$');

alter table public.cup_changes drop constraint if exists cup_changes_change_check;
alter table public.cup_changes add constraint cup_changes_change_check
  check (change ~ '^(p[0-4]|m[0-2]|s[0-2]|x[0-9a-z]{2}|y[0-9a-z]{4})$');
