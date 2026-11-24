-- =====================================================================
-- Prancheta — clubes
-- Princípio: guardar só o essencial. Escudo e camisa são códigos curtos
-- (números separados por ponto) que o navegador transforma em desenho.
-- Elenco inicial, cartas e visuais saem de uma seed = id do clube, então
-- não precisam de linhas no banco até evoluírem.
-- Tamanho estimado: ~100 bytes por clube (+ índice do nome).
-- =====================================================================

create table if not exists public.clubs (
  -- 1 clube por usuário: a chave é o próprio id do usuário
  id         uuid primary key references auth.users (id) on delete cascade,
  name       text not null,
  tag        text not null,          -- sigla, ex.: "TUB"
  crest      text not null,          -- escudo:  formato.padrão.símbolo.cor1.cor2.cor3
  kit        text not null,          -- camisa:  modelo.cor1.cor2.cor3
  created_at timestamptz not null default now(),

  constraint clubs_name_len   check (char_length(name) between 3 and 22),
  constraint clubs_name_chars check (name ~ '^[[:alnum:] À-ÿ''.-]+$' and name !~ '\s{2,}' and name = btrim(name)),
  constraint clubs_tag_fmt    check (tag ~ '^[A-Z0-9]{3}$'),
  constraint clubs_crest_fmt  check (crest ~ '^[0-9]{1,2}(\.[0-9]{1,2}){5}$'),
  constraint clubs_kit_fmt    check (kit ~ '^[0-9]{1,2}(\.[0-9]{1,2}){3}$')
);

-- Nome único sem diferenciar maiúsculas/minúsculas
create unique index if not exists clubs_name_unique on public.clubs (lower(name));

-- ------------------------------------------------------------------ RLS
alter table public.clubs enable row level security;

drop policy if exists "clubs: leitura para logados" on public.clubs;
create policy "clubs: leitura para logados" on public.clubs
  for select to authenticated using (true);

drop policy if exists "clubs: cria o próprio" on public.clubs;
create policy "clubs: cria o próprio" on public.clubs
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "clubs: edita o próprio" on public.clubs;
create policy "clubs: edita o próprio" on public.clubs
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Só as colunas necessárias podem ser escritas pelo app
revoke all on public.clubs from anon, authenticated;
grant select on public.clubs to authenticated;
grant insert (id, name, tag, crest, kit) on public.clubs to authenticated;
grant update (crest, kit) on public.clubs to authenticated;
