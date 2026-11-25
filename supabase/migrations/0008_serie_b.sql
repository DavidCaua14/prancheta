-- =====================================================================
-- Prancheta — Série B
-- Série C passa a ter acesso (4 sobem) e a Série B (division 3) entra,
-- com 3 rebaixados. Espelho de lib/league/divisions.ts.
-- =====================================================================
create or replace function public.division_rules(p_division smallint, out up smallint, out down smallint)
language sql immutable as $$
  select case p_division when 0 then 4 when 1 then 4 when 2 then 4 else 0 end::smallint,
         case p_division when 1 then 3 when 2 then 3 when 3 then 3 else 0 end::smallint
$$;
