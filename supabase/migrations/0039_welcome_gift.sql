-- =====================================================================
-- Prancheta — presente de boas-vindas: 5.000 moedas (o lance numa carta boa)
--
-- Vale para todo clube, existente ou novo, uma única vez: o técnico recebe ao
-- chegar na sede com o time montado (squad), e o app mostra a animação.
-- clubs.gifts é um conjunto de bits (1 = presente de boas-vindas 5.000) e,
-- como coins, o app não consegue alterá-lo (sem grant de update na coluna).
-- =====================================================================

alter table public.clubs add column if not exists gifts smallint not null default 0;

create or replace function public.claim_gifts() returns integer
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  got int := 0;
begin
  if uid is null then raise exception 'login necessário' using errcode = '28000'; end if;
  update public.clubs
     set coins = coins + 5000, gifts = gifts | 1
   where id = uid and squad is not null and gifts & 1 = 0;
  if found then got := 5000; end if;
  return got;  -- 0 = já recebeu (ou ainda sem time)
end $$;
revoke all on function public.claim_gifts() from public, anon;
grant execute on function public.claim_gifts() to authenticated;
