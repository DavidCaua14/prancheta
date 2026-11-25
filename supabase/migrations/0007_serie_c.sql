-- =====================================================================
-- Prancheta — Série C
-- Série D passa a ter acesso (4 sobem) e a Série C (division 2) entra,
-- com 3 rebaixados. Espelho de lib/league/divisions.ts.
-- =====================================================================
create or replace function public.division_rules(p_division smallint, out up smallint, out down smallint)
language sql immutable as $$
  select case p_division when 0 then 4 when 1 then 4 else 0 end::smallint,
         case p_division when 1 then 3 when 2 then 3 else 0 end::smallint
$$;
