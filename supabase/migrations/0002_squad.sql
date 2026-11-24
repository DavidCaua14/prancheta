-- =====================================================================
-- Prancheta — elenco inicial ("peneira")
-- As cartas NÃO são guardadas. Cada opção da peneira é gerada no
-- navegador a partir de (id do clube, vaga, nº da opção), sempre igual.
-- O banco guarda só QUAL opção foi escolhida em cada vaga:
--   "1:" (versão do gerador) + 11 titulares (opção 0-2) + 3 reservas (0-4)
--   ex.: "1:01201120210143"  → 16 bytes por clube.
-- =====================================================================

alter table public.clubs add column if not exists squad text;

alter table public.clubs drop constraint if exists clubs_squad_fmt;
alter table public.clubs add constraint clubs_squad_fmt check (squad is null or squad ~ '^1:[0-2]{11}[0-4]{3}$');

-- A peneira acontece uma vez só: depois de confirmado, o elenco inicial não muda.
create or replace function public.clubs_lock_squad() returns trigger
language plpgsql as $$
begin
  if old.squad is not null and new.squad is distinct from old.squad then
    raise exception 'elenco inicial já confirmado' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists clubs_lock_squad on public.clubs;
create trigger clubs_lock_squad before update of squad on public.clubs
  for each row execute function public.clubs_lock_squad();

grant update (crest, kit, squad) on public.clubs to authenticated;
