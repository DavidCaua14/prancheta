-- =====================================================================
-- Prancheta — Liga das Lendas
-- Série A passa a ter acesso (4 sobem) e a Liga das Lendas (division 5,
-- o topo) entra, com 3 rebaixados. Espelho de lib/league/divisions.ts.
-- =====================================================================
create or replace function public.division_rules(p_division smallint, out up smallint, out down smallint)
language sql immutable as $$
  select case when p_division between 0 and 4 then 4 else 0 end::smallint,
         case when p_division between 1 and 5 then 3 else 0 end::smallint
$$;
