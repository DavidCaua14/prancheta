-- =====================================================================
-- Prancheta — escalação e tática
-- Uma linha de texto curta por clube (~23 bytes):
--   "1:F:XXXXXXXXXXX:PMS:CK"
--   1  versão do formato
--   F  formação (0-5: 4-3-3, 4-4-2, 3-5-2, 4-5-1, 5-3-2, 3-4-3)
--   X  os 11 titulares, na ordem das vagas da formação; cada caractere é o
--      índice da carta no elenco (0-9, a-d → até 14 jogadores)
--   P  postura (0-4)   M marcação (0-2)   S passes (0-2)
--   C  capitão   K  cobrador de pênaltis (precisam estar entre os titulares)
-- =====================================================================

create or replace function public.lineup_ok(l text) returns boolean
language sql immutable as $$
  select l ~ '^1:[0-5]:[0-9a-d]{11}:[0-4][0-2][0-2]:[0-9a-d]{2}$'
     and (select count(distinct c) from regexp_split_to_table(split_part(l, ':', 3), '') as c) = 11
     and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 1, 1)) > 0
     and strpos(split_part(l, ':', 3), substr(split_part(l, ':', 5), 2, 1)) > 0
$$;

alter table public.clubs add column if not exists lineup text;

alter table public.clubs drop constraint if exists clubs_lineup_ok;
alter table public.clubs add constraint clubs_lineup_ok
  check (lineup is null or (squad is not null and public.lineup_ok(lineup)));

grant update (crest, kit, squad, lineup) on public.clubs to authenticated;
