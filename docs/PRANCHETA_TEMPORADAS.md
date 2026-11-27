# Prancheta Temporadas — especificação para construção

> **Como usar este documento.** Entregue-o inteiro à IA/desenvolvedor junto com o repositório do Prancheta (o jogo
> online). Ele diz **o que** construir, **o que é proibido** (principalmente no banco de dados) e **em que ordem**.
> Onde aparecer **PERGUNTAR AO DONO**, a IA para e pergunta — não decide sozinha.
>
> **Prompt para colar junto:**
> *"Construa o Prancheta Temporadas seguindo `docs/PRANCHETA_TEMPORADAS.md` à risca. Comece pela Fase 0 e só avance
> quando os critérios de aceite da fase atual passarem. Nunca crie tabela, coluna, RPC, bucket ou função de servidor
> que não esteja na seção 6 sem me perguntar. Reaproveite o motor, os componentes e o visual do Prancheta (seção 5.3).
> A divulgação do Prancheta Online (seção 4) é parte obrigatória de cada tela, não um extra."*

**Sumário**

1. Visão e objetivo de negócio
2. Decisões já tomadas pelo dono
3. Restrições inegociáveis (banco de dados)
4. Divulgação do Prancheta Online dentro do jogo
5. Arquitetura
6. Banco de dados (único uso do servidor)
7. O save
8. Dados reais: clubes, jogadores e escudos
9. Simulação
10. Sistemas de jogo
11. Telas (com os espaços de divulgação)
12. Desempenho no aparelho
13. Fases de entrega
14. Testes obrigatórios
15. Fora de escopo

---

## 1. Visão e objetivo de negócio

**Prancheta Temporadas** é um manager de futebol **single-player e "offline"**, no estilo Brasfoot / Football
Manager, com a **mesma identidade visual** do Prancheta (cartoon anos 90, Bungee + Baloo 2, contornos grossos,
sombras sólidas), e com **clubes, escudos e jogadores reais**.

- O jogador é um **técnico** (não dono do clube). Começa num clube real de divisão baixa (ex.: Série D do Brasil,
  Segunda Federación da Espanha) e constrói a carreira: pode ser demitido, receber propostas e trocar de clube.
- **Reputação** é o eixo da carreira: define quais clubes oferecem emprego, o orçamento e o respeito dos jogadores.
- Manager completo: tática imersiva, atributos que fazem diferença, transferências negociadas com o clube **e** com o
  jogador, contratos, CT, base, finanças, diretoria, ligas e copas reais.
- **Tudo roda no aparelho.** O servidor só guarda uma cópia do progresso para a conta não se perder.

**Objetivo de negócio (orienta todas as decisões):** o Temporadas é **gratuito e não monetizado**. Ele existe para
**levar o jogador ao Prancheta Online**, que é monetizado. Toda tela tem divulgação do online (seção 4), e o próprio
jogo ensina, sem ser chato, o que o online tem a mais: técnicos de verdade como rivais, ranking, leilão, copas
diárias, amistosos com amigos.

### 1.1 Não é

- Não é multiplayer; não tem ranking, mercado entre usuários nem nada que dependa de outro usuário.
- Não tem moeda paga nem anúncios de terceiros (a única "propaganda" é a do Prancheta Online).
- Não compartilha economia com o online (seção 4.5).

---

## 2. Decisões já tomadas pelo dono

| Tema | Decisão |
|---|---|
| Escudos | **Escudos reais dos clubes.** O dono fornece os arquivos e assume a responsabilidade pelo uso (licenças/autorizações). A IA só integra (seção 8.4). |
| Clubes e competições | **Reais**, com os formatos reais de cada país (seção 8.2). |
| Jogadores | **Reais** (nome, idade, posição, nacionalidade, clube). Atributos são **estimados pelo jogo** (seção 8.3). |
| Divulgação | Propaganda do Prancheta Online **na tela inicial e nas demais telas** (seção 4). |
| Banco de dados | Só para salvar o progresso; extremamente leve (seção 3). |

**Limites para a IA (proteção do projeto):**

- **Não raspar** sites cujos termos proíbem extração automática (Transfermarkt, Sofascore, sites de jogos como
  Football Manager/EA FC). Fontes de dados permitidas estão na seção 8.1.
- **Não baixar escudos por conta própria.** Usar apenas os arquivos que o dono colocar em `data-src/logos/`
  (seção 8.4).
- Registrar a origem de cada dado em `data-src/FONTES.md` (fonte, licença, data). Wikipédia exige atribuição
  (CC BY-SA); Wikidata não (CC0).

> **Nota ao dono:** escudos, nomes de ligas e nomes de jogadores são marcas e direitos de imagem de terceiros, e o
> jogo divulga um produto pago. Vale consultar um advogado antes de lançar. A arquitetura deixa trocar todo o pacote
> de dados sem mudar o código, caso algum clube peça a retirada.

---

## 3. Restrições inegociáveis (banco de dados)

Hoje o Supabase do Prancheta usa 29 MB de 500 MB de banco. O Temporadas deve caber nessa faixa mesmo com muitos
usuários.

| # | Regra | Por quê |
|---|---|---|
| R1 | **≤ 300 bytes por slot** na tabela do Temporadas (só metadados), mais a linha de controle que o Storage cria por arquivo (~0,5–1 KB). **1 slot na nuvem por usuário** (até 3 saves locais). | 50 mil usuários × ~1,3 KB ≈ 65 MB no banco. |
| R2 | **O save vai para o Supabase Storage, nunca para o banco.** Alvo ≤ 20 KB comprimido; limite duro 128 KB (o bucket recusa acima). | Storage grátis: 1 GB → ~50 mil carreiras. |
| R3 | **Clubes, jogadores, competições e escudos são arquivos estáticos** do site (`public/`), servidos pela hospedagem/CDN. Nunca no banco, nunca no Storage do Supabase. | Não pesa no banco nem no tráfego do Supabase (5 GB/mês). |
| R4 | **Nenhuma escrita no banco durante o jogo.** Só em checkpoints (seção 7.4): no máximo 1 envio a cada 3 min, e só se o save mudou. | Banco e tráfego mínimos; o jogo segue sem internet. |
| R5 | **Simulação 100% no aparelho**, em Web Worker, determinística (mesma semente → mesmo resultado). | O servidor não processa nada. |
| R6 | **IndexedDB é a fonte da verdade local** (não localStorage). A nuvem é cópia de segurança. | Saves e cache maiores, autosaves. |
| R7 | Zero Edge Functions, zero cron, zero Realtime para o Temporadas. | Custo zero de servidor. |
| R8 | Nada no Temporadas dá vantagem de jogo no online (seção 4.5). | O save é local e pode ser manipulado. |

**Orçamento com 50 mil usuários (plano grátis):**

| Recurso | Limite | Uso previsto |
|---|---|---|
| Banco | 500 MB | ~+65 MB (`tp_saves` + linhas de controle do Storage) |
| Storage | 1 GB | até ~1 GB no pior caso (50 mil × 20 KB); a limpeza de inativos (6.4) reduz bem |
| Tráfego (egress) | 5 GB/mês | o save só é baixado quando a nuvem é mais nova que o aparelho (~20 KB por troca de aparelho) |
| Usuários ativos | 50 mil/mês | conta compartilhada com o online (mesmo login) |

Escudos e elencos **não entram nessa conta**: são arquivos do site (R3).

---

## 4. Divulgação do Prancheta Online dentro do jogo

### 4.1 Princípios

1. **Presente em todas as telas**, sempre com um caminho de 1 toque para o online.
2. **Nunca trava o jogo**: nada de contagem regressiva obrigatória ou vídeo. Todo bloco grande fecha na hora.
3. **Mostra, não só pede**: cada peça destaca **uma** coisa que o online tem e o modo carreira não tem.
4. **No momento certo**: os convites mais fortes aparecem depois de emoções (vitória, título, acesso, demissão), não
   no meio de uma decisão.
5. **Mesmo visual do jogo** (painéis, botões e ilustrações do Prancheta), com o selo "Prancheta Online".

### 4.2 Espaços de divulgação (obrigatórios)

| Código | Onde | Formato | Frequência |
|---|---|---|---|
| `home-hero` | Tela inicial (sede), logo abaixo do cabeçalho | Cartão grande ilustrado: "Seu time contra técnicos de verdade — Jogar o Prancheta Online" | Sempre (pode ser recolhido para uma faixa fina, que volta a abrir após 7 dias) |
| `home-side` | Sede, coluna lateral (computador) / fim da página (celular) | Cartão com a novidade da semana do online (copa do dia, leilão, ranking) | Sempre; o conteúdo gira entre as peças |
| `nav-online` | Menu (inferior no celular, lateral no computador) | Item fixo "Online" com selo, abre a página de apresentação do online | Sempre |
| `match-pre` | Antes do apito da partida ao vivo | Faixa: "No online, o adversário é uma pessoa mexendo no time ao vivo" | 1 a cada 3 jogos |
| `match-half` | Intervalo da partida ao vivo | Cartão pequeno ao lado da conversa de intervalo | 1 a cada 3 jogos |
| `match-end` | Fim da partida | Cartão conforme o resultado (vitória: "prove contra gente de verdade"; derrota: "no online você monta o elenco no leilão") | 1 a cada 2 jogos |
| `inbox` | Caixa de entrada | Mensagem do "Prancheta Online" (novidades, convite, recompensa cosmética) | No máximo 1 por semana de jogo |
| `news` | Notícias do jogo | Nota com o título no estilo de jornal, ex.: "Copa da Várzea online tem 32 técnicos hoje" | 1 a cada ~10 notícias |
| `season-end` | Resumo do fim de temporada | Tela cheia com o resumo da carreira + convite principal | Sempre (fecha na hora) |
| `milestone` | Título, acesso, demissão, proposta de clube grande | Cartão de comemoração com convite | Sempre nesses momentos (no máximo 1 por dia real) |
| `loading` | Telas de carregamento e "Continuar" demorado | Dicas que mencionam o online ("Sabia que no online...?") | 1 a cada 3 dicas |
| `market` | Mercado/negociação | Faixa: "No online, cartas raras saem no leilão a cada 2 horas" | Sempre (faixa fina) |
| `career` | Tela de carreira/histórico | Cartão "Leve seu nome para o ranking dos técnicos reais" | Sempre |
| `landing` | Página pública `/temporadas` | Seção "Quando cansar da CPU, jogue o online" + botões lado a lado | Sempre |

O componente único `components/tp/promo/PromoSlot.tsx` recebe o código do espaço e escolhe a peça.

### 4.3 Conteúdo das peças

- Peças em `public/tp/promo.json` (estático, R3): título, texto curto, ilustração, botão, espaços onde aparece,
  período de validade, peso no sorteio. Trocar uma campanha é só editar esse arquivo e publicar.
- A escolha usa uma semente do aparelho + data, para não repetir a mesma peça seguida.
- Contadores de frequência e "recolhido" ficam no IndexedDB do aparelho (nada no banco).
- Ilustrações das peças: prompts prontos em `docs/PROMPTS-DIVULGACAO.md` (grupo A, só escudos inventados, como no
  online). As peças do Temporadas que aparecem no online (grupo B) têm **escudos em branco** na arte, e o componente
  `Crest` encaixa o escudo real por cima, nas posições indicadas no arquivo.

### 4.4 Para onde o botão leva e como medir

- Todo botão abre o online com `?ref=tp&slot=<código>` (ex.: `/?ref=tp&slot=match-end`).
- **Mesma conta:** quem está logado no Temporadas já está logado no online, sem novo cadastro.
- **Medição (no online, mínimo possível):** o online guarda `ref`/`slot` no aparelho e, ao criar o clube, grava
  numa coluna nova `clubs.ref smallint` (código do espaço; 2 bytes). **PERGUNTAR AO DONO** antes de criar a coluna.
  O painel `/admin` mostra quantos clubes do online vieram de cada espaço.
- Cliques que não viraram cadastro não são registrados no banco (R4). Se quiser, contar pela análise de tráfego da
  hospedagem, não pelo Supabase.

### 4.5 Recompensa cruzada (só cosmética)

- Ao terminar a 1ª temporada, o jogador libera **uma** recompensa cosmética no online (ex.: moldura de escudo
  "Técnico de carreira"), uma vez por conta.
- **Nunca** moedas, cartas, XP ou qualquer vantagem: o save é local e pode ser manipulado (R8).
- **PERGUNTAR AO DONO** qual recompensa e onde ela aparece no online.

---

## 5. Arquitetura

### 5.1 Onde fica

**No mesmo projeto Next.js do Prancheta**, como uma área própria:

```
app/temporadas/            → landing pública e telas do Temporadas
lib/tp/                    → lógica do Temporadas (TypeScript puro, sem React)
lib/tp/worker/             → Web Worker de simulação
components/tp/             → componentes do Temporadas (inclui promo/PromoSlot.tsx)
public/tp/data/            → pacotes de dados gerados (seção 8)
public/tp/logos/           → escudos otimizados (seção 8.4)
public/tp/promo.json       → peças de divulgação (seção 4.3)
data-src/                  → fontes brutas (planilhas, escudos originais); NÃO vai para o site
scripts/tp/                → scripts que geram public/tp/* a partir de data-src/
supabase/migrations/00xx_tp_saves.sql
```

Vantagens: mesmo login, mesmo design system, mesmo motor de partida, e o online está a um link de distância.
`lib/tp` não importa nada de `app/`, então a área pode virar outro site no futuro sem mudar a lógica.

### 5.2 Camadas

```
UI (React, components/tp)  ──pede──▶  Store da carreira (lib/tp/store, em memória)
                                         │  ▲
                        avançar o dia    ▼  │  estado novo
                                    Web Worker (lib/tp/worker): jogos, IA dos clubes, mercado
                                         │
                       autosave ─────────▼─────────▶ IndexedDB (fonte da verdade local)
                                                            │ checkpoint (seção 7.4)
                                                            ▼
                                      Supabase Storage (blob)  +  tp_saves (1 linha de metadados)
```

- **Determinismo:** toda aleatoriedade vem de `rng(semente)` com sementes de `hash32(\`${saveSeed}:${contexto}\`)`
  (já existem em `lib/cards/generate.ts` e `lib/sim/engine.ts`). Nunca `Math.random()` na lógica de jogo.
- **Worker:** a interface nunca trava; "Continuar" roda no worker e devolve o novo estado e as notícias.
- **PWA:** manifesto + service worker. Depois do 1º acesso, o jogo abre sem internet (dados e escudos em cache).

### 5.3 O que reaproveitar do Prancheta (obrigatório)

| Do Prancheta | Uso no Temporadas |
|---|---|
| `lib/sim/engine.ts` (`simulate`) | Motor das partidas: **estender**, não reescrever (seção 9.2). ~1 ms por jogo no servidor, ~3–4 ms no celular. |
| `lib/sim/board.ts`, `components/match/*` (`MatchBoard`, `Feed`, `Scoreboard`, `CameraButton`, `StatsPanel`) | Partida ao vivo com narração, câmera opcional e escudo do time em cada lance (padrão do jogo). O `Feed` passa a aceitar escudo como imagem. |
| `lib/tactics/formations.ts`, `lib/tactics/lineup.ts`, `fitLevel` | Formações, postura, marcação, passe, linha, amplitude, ritmo e encaixe por posição: a base da tática. |
| `components/club/CrestSvg.tsx`, `KitSvg.tsx` | Reserva para clube sem escudo (gera um a partir das cores) e uniformes. |
| `app/globals.css` (cores `--ink`, `--night`, `--sun`, `--grass`…; classes `.btn`, `.tag`, `.t-heading`, `.t-num`) | Identidade visual idêntica. |
| `components/ui/ArtImg`, `Icon`, `Art` | Ícones e ilustrações. |
| Otimizações já feitas: `memo` em listas, redesenhar só o que mudou, caches por chave | Seção 12. |

---

## 6. Banco de dados (único uso do servidor)

### 6.1 Migração (exatamente isto)

```sql
-- Prancheta Temporadas: só metadados do save. O save em si fica no Storage (bucket tp-saves).
create table if not exists public.tp_saves (
  user_id     uuid not null references auth.users (id) on delete cascade,
  slot        smallint not null default 0 check (slot = 0),        -- 1 slot na nuvem (R1)
  version     integer not null default 1,                          -- sobe a cada envio (conflitos)
  format      smallint not null,                                   -- versão do formato do save
  bytes       integer not null check (bytes between 1 and 131072),
  checksum    text not null check (char_length(checksum) <= 16),   -- hash curto do arquivo
  device      text check (char_length(device) <= 24),              -- id aleatório do aparelho
  summary     jsonb not null check (pg_column_size(summary) <= 160),
  -- summary: {"c":"Clube","l":"Série D","s":2031,"r":47,"t":2} = clube, liga, temporada, reputação, títulos
  updated_at  timestamptz not null default now(),
  primary key (user_id, slot)
);
alter table public.tp_saves enable row level security;
create policy "tp_saves: o meu" on public.tp_saves for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke all on public.tp_saves from anon;
grant select, insert, update, delete on public.tp_saves to authenticated;

-- Confirma um envio: só grava se a versão esperada bate (outro aparelho não sobrescreve sem aviso).
create or replace function public.tp_commit(p_slot smallint, p_expected int, p_format smallint, p_bytes int,
                                            p_checksum text, p_device text, p_summary jsonb)
returns integer language plpgsql security invoker set search_path = public as $$
declare v int;
begin
  insert into public.tp_saves as s (user_id, slot, version, format, bytes, checksum, device, summary)
  values (auth.uid(), p_slot, 1, p_format, p_bytes, p_checksum, p_device, p_summary)
  on conflict (user_id, slot) do update
    set version = s.version + 1, format = excluded.format, bytes = excluded.bytes, checksum = excluded.checksum,
        device = excluded.device, summary = excluded.summary, updated_at = now()
    where s.version = p_expected
  returning version into v;
  return v;  -- null = conflito (a nuvem tem uma versão mais nova)
end $$;
revoke all on function public.tp_commit(smallint, int, smallint, int, text, text, jsonb) from public, anon;
grant execute on function public.tp_commit(smallint, int, smallint, int, text, text, jsonb) to authenticated;
```

**Storage:** bucket privado `tp-saves`, limite de arquivo **128 KB**, tipo `application/octet-stream`. Caminho
`{user_id}/0.bin` (sobrescreve; sem histórico na nuvem). Políticas de `select/insert/update/delete` só quando
`(storage.foldername(name))[1] = auth.uid()::text`.

### 6.2 Proibido no banco

- Qualquer dado de jogador, clube, escudo, partida, estatística, notícia, histórico, tática ou transferência.
- Uma linha por ação, rodada ou temporada. **Uma linha por usuário, e só.**
- Logs ou métricas de jogo. Para contar uso, chamar o `ping('/temporadas/...')` que o online já tem (no máximo
  1×/min, com a aba visível); ele já alimenta "online agora" e "ativos" no painel admin.
- Exceção única, fora do Temporadas: a coluna `clubs.ref` do online (seção 4.4), se o dono aprovar.

### 6.3 Painel admin (Fase 7)

Somar ao `/admin` existente: total de carreiras, salvas nos últimos 7 dias, tamanho médio (`avg(bytes)`), maiores
reputações (do `summary`) e conversões por espaço de divulgação (`clubs.ref`). Uma função `admin_tp_overview()` no
padrão das `admin_*` existentes.

### 6.4 Limpeza

Saves sem atualização há **180 dias** podem ser apagados da nuvem; o aparelho mantém a cópia. Fazer pelo painel
admin (botão "limpar saves inativos"), sem cron (R7).

---

## 7. O save

### 7.1 Princípio: guardar só o que não dá para recalcular

O mundo inicial vem do **pacote de dados** (estático) + **semente da carreira**. O save guarda só o que mudou desde
então. Tabelas, artilharia, valor de mercado, força dos times e narrações antigas **não** vão no save: são
recalculados a partir dos resultados e da semente.

### 7.2 Conteúdo (formato 1)

| Bloco | Conteúdo | Tamanho típico (comprimido) |
|---|---|---|
| Cabeçalho | formato, id e versão do pacote de dados, semente, data do jogo | < 100 B |
| Técnico | nome, nacionalidade, idade, reputação, atributos, cargos (clube, período, títulos) | ~300 B |
| Clubes | só os que mudaram: caixa, folha salarial, CT/base, técnico (se a IA trocou) | ~1–2 KB |
| Jogadores | **diferenças** em relação ao pacote: clube, contrato (fim, salário, multa), atributos (delta por atributo, int8), condição e moral só do seu elenco, lesões e suspensões | ~6–10 KB |
| Jovens gerados (regens) | semente de geração + diferenças | ~1–2 KB |
| Temporada atual | resultados com 1 byte por jogo (4 bits por time; tabela de exceção para >15 gols), fase das copas, estatísticas individuais **só do seu elenco** | ~2–4 KB |
| Seu clube | táticas salvas, escalação, treino, olheiros, propostas abertas, objetivos da diretoria, caixa de entrada (não lidas + últimas 30) | ~1–2 KB |
| Histórico | por temporada: campeões das competições carregadas e a sua campanha resumida | ~40 B/temporada |

**Codificação:** binária (`DataView`/`TypedArray`, inteiros pequenos, ids numéricos do pacote; texto só para nomes
criados pelo usuário) e depois `CompressionStream('gzip')`. Nada de JSON no arquivo.

**Metas verificadas por teste:** ≤ 10 KB depois de 1 temporada; ≤ 20 KB depois de 10; nunca acima de 128 KB. Se
passar, podar: caixa de entrada antiga, estatísticas antigas, regens aposentados.

### 7.3 Versões do formato e do pacote

- `format` sobe quando o formato do save muda; `lib/tp/save/migrate.ts` converte em cadeia (`1→2→3…`).
- Quando o **pacote de dados** muda (nova temporada real, elencos atualizados), carreiras em andamento continuam no
  pacote em que começaram: o save guarda `id+versão` do pacote, e as versões antigas ficam publicadas. Carreiras
  novas usam o pacote mais recente.

### 7.4 Quando salvar

- **Local (IndexedDB):** a cada dia avançado (3 autosaves em rodízio) e ao fechar a aba.
- **Nuvem:** ao fim de cada rodada **ou** a cada 3 min de jogo ativo (o que vier depois), em "Salvar e sair" e no
  fim da temporada, **só se o checksum mudou**. Sem internet: marca "pendente" e envia quando a conexão voltar.
- Ordem do envio: (1) upload para `tp-saves/{uid}/0.bin`, (2) `rpc('tp_commit')` com a versão esperada. Se voltar
  `null` (conflito), mostrar: "Esta carreira foi alterada em outro aparelho em {data}. Qual manter?" com o resumo de
  cada uma.
- **Ao abrir:** ler só a linha de `tp_saves` (~300 B); baixar o arquivo **apenas** se a nuvem for mais nova.
- **Convidado:** dá para começar sem conta (save só local). Ao criar conta, o save sobe para a nuvem sem perder nada.
  A tela de criar conta é também um espaço de divulgação: "a mesma conta vale no Prancheta Online".

---

## 8. Dados reais: clubes, jogadores e escudos

### 8.1 Fontes permitidas

| Dado | Fonte | Licença / cuidado |
|---|---|---|
| Clubes, estádios, cidades, cores | Wikidata (consulta SPARQL) | CC0: pode usar livremente |
| Elencos (nome, data de nascimento, posição, nacionalidade, clube) | Wikidata; páginas de elenco da Wikipédia | Wikidata CC0; Wikipédia CC BY-SA (citar em `FONTES.md` e nos créditos do jogo) |
| Formatos de competição (grupos, acessos, copas) | Regulamentos oficiais / Wikipédia | Só os fatos (número de times, regras) |
| Escudos | **Arquivos fornecidos pelo dono** em `data-src/logos/` | Responsabilidade do dono (seção 2) |
| Atributos dos jogadores | **Calculados pelo jogo** (8.3) | Nunca copiados de FM/EA FC/sites de notas |

A coleta é feita por scripts em `scripts/tp/`, que geram `data-src/<pais>/*.csv`. **O dono revisa** as planilhas
(corrige elencos, notas e escudos) antes de gerar o pacote.

### 8.2 Escopo inicial de países

**PERGUNTAR AO DONO** a lista final. Sugestão para o lançamento:

| País | Divisões | Copas | Ordem de grandeza |
|---|---|---|---|
| Brasil | Séries A, B, C, D | Copa do Brasil | ~124 clubes / ~3.100 jogadores |
| Espanha | 1ª, 2ª, Primera Federación, Segunda Federación | Copa del Rey, Supercopa | ~172 clubes / ~4.300 jogadores |

Continentais (Libertadores, Sul-Americana, Champions etc.) entram quando houver 2+ países do continente: os
classificados reais disputam, e os clubes de países não carregados entram com elencos fixos.

### 8.3 Jogadores: atributos estimados

Cada jogador real recebe atributos 1–20 (seção 10.7) gerados por `lib/tp/data/rate.ts`, a partir de:

- **nível da competição** em que joga (pontuação base por divisão e país);
- **status no clube** (titular, rodízio, reserva), se a fonte informar, ou a idade;
- **posição** (o perfil de atributos muda: zagueiro forte em desarme/cabeceio etc.);
- **idade** (jovens com potencial maior e atributos menores);
- semente do jogador, para variar dentro do perfil.

A planilha do país tem colunas opcionais `ovr` e `pot` para o dono ajustar à mão (craques, promessas). O script
respeita esses valores e gera o resto.

### 8.4 Escudos reais

**O `logos.zip` enviado não serve como escudo:** ele tem só cartazes de pré-visualização (uma imagem de 1200×630
por país com dezenas de escudos de ~50 px). Os escudos individuais (PNG transparente até 3000 px e SVG) estão em
football-logos.cc, como o próprio README do pacote indica.

**Como o dono entrega:**

1. Para cada país do escopo, colocar os arquivos individuais em `data-src/logos/<pais>/` (SVG preferido; PNG
   transparente ≥ 256 px).
2. Nome do arquivo = nome do clube em minúsculas com hífens (ex.: `sao-jose-ec.svg`). Se não bater com a planilha,
   preencher a coluna `logo` da planilha com o nome do arquivo.

**O que o script `scripts/tp/build-logos.mjs` faz:**

- Converte para **WebP 128×128** (~3–6 KB cada) e um **WebP 48×48** para listas e narração (~1–2 KB), em
  `public/tp/logos/<pais>/<id-do-clube>-128.webp` e `-48.webp`.
- Remove bordas transparentes e centraliza; mantém a proporção.
- Relatório no final: clubes sem escudo, arquivos sem clube, arquivos pequenos demais.
- Clube sem escudo usa o gerador do Prancheta (`CrestSvg`) com as cores do clube, sem quebrar a tela.

**Tamanho:** ~270 escudos do Brasil ≈ 1,5 MB no total; só os da liga aberta são baixados (`loading="lazy"`), e o
service worker guarda em cache. Nada disso passa pelo Supabase (R3).

**Componente:** `components/tp/Crest.tsx` (`<Crest club={id} size={48|128} />`) é o único jeito de mostrar escudo
no Temporadas. Narração, tabelas, placar, propostas e notícias usam esse componente.

### 8.5 Formato do pacote gerado

```
public/tp/data/<pacote>@<versão>/index.json   → países, competições, calendário, regras (≤ 30 KB)
public/tp/data/<pacote>@<versão>/<pais>.json  → clubes + jogadores do país (baixado sob demanda)
```

`index.json` (resumo):

```json
{
  "id": "real", "version": 1, "season": 2027,
  "countries": [{ "id": "br", "name": "Brasil", "file": "br.json" }, { "id": "es", "name": "Espanha", "file": "es.json" }],
  "competitions": [
    { "id": "br-d", "country": "br", "type": "league", "tier": 4, "name": "Série D", "format": "groups+knockout",
      "groups": 8, "teamsPerGroup": 8, "promote": 4 },
    { "id": "br-cup", "country": "br", "type": "cup", "name": "Copa do Brasil", "legs": 2, "entry": ["br-a","br-b","br-c","br-d"] },
    { "id": "es-4", "country": "es", "type": "league", "tier": 4, "name": "Segunda Federación", "groups": 5,
      "teamsPerGroup": 18, "promote": "playoff", "relegate": 5 }
  ]
}
```

`<pais>.json` usa arrays por posição (não objetos) e ids numéricos estáveis, documentados e validados em
`lib/tp/data/schema.ts`:

```json
{
  "clubs":   [[101, "Nome do Clube", "SIG", "br-d", "#0a3d91", "#ffffff", 12000, 45]],
  "players": [[50012, 101, "Nome do Jogador", "2001-04-12", "MEI", "D", "BR", 64, 78, [12, 14, 9]]]
}
```

~150–250 KB comprimido por país, baixado só quando a carreira usa o país.

### 8.6 Mundo "carregado" (como no FM)

Ao criar a carreira, o jogador escolhe **até 3 países carregados** (o do clube inicial é obrigatório). Países
carregados têm simulação completa e mercado detalhado. Os outros ficam **congelados**: elencos fixos, usados só
como origem de propostas de técnico e de transferências raras. Isso mantém o save pequeno e o "Continuar" rápido.

---

## 9. Simulação

### 9.1 Três níveis de fidelidade

| Nível | Onde | Como |
|---|---|---|
| **Ao vivo** | Jogos do seu clube | `simulate` completo, com narração, quadro animado, mudanças táticas e substituições, igual à partida do Prancheta. |
| **Completo, sem narração** | Demais jogos das competições do seu clube e dos países carregados | `simulate` com `quiet: true` (sem gerar texto). Guarda placar e, quando necessário para notícias, autores dos gols. |
| **Rápido** | Países congelados | Modelo estatístico (Poisson pela força dos times), ~0,01 ms por jogo. |

Custo estimado: 3 países carregados ≈ 2.000 jogos por temporada × ~4 ms ≈ 8 s no celular, **distribuídos** por ~40
rodadas (~0,2 s por "Continuar"), no worker. Meta: "Continuar" ≤ 400 ms no celular médio.

### 9.2 Extensões do motor (`lib/sim/engine.ts`)

Sem quebrar o online (os testes do online continuam passando):

- Aceitar jogadores com **atributos completos** (seção 10.7) e derivar as notas que o motor já usa.
- **Condição física** (cai durante o jogo, mais com ritmo alto e pressão), **moral** e **entrosamento** como
  multiplicadores.
- **Função por posição** (seção 10.6) muda quem participa de cada lance (lateral apoiador aparece em cruzamentos,
  volante destruidor em desarmes etc.).
- Bola parada com os batedores escolhidos pelo técnico.
- Lesões e cartões influenciados por atributos (agressividade, propensão a lesão).
- Flag `quiet` para a simulação em massa.

**Teste obrigatório:** com o mesmo elenco, uma tática coerente com os atributos (time rápido + linha alta +
contra-ataque) vence de forma mensurável uma tática incoerente, em 2.000 simulações.

---

## 10. Sistemas de jogo

### 10.1 Carreira do técnico

- Criação: nome, nacionalidade, idade (30–60), **estilo preferido** (ofensivo, equilibrado, defensivo) e passado
  (ex-jogador profissional, ex-amador ou sem experiência), que definem a reputação inicial.
- Atributos do técnico (1–20, sobem com o tempo e com cursos): tática, motivação, desenvolvimento de jovens,
  disciplina, adaptabilidade, conhecimento de mercado, negociação.
- **Licenças** (Básica → A → Pro): cursos que custam tempo; clubes grandes exigem a Pro.
- Escolha do clube inicial: só clubes de **divisões baixas** (Série D, Segunda Federación etc.), com escudo real,
  expectativa da diretoria, orçamento e força do elenco.

### 10.2 Reputação (0–100)

- Começa entre 5 e 20, conforme o passado.
- Sobe com resultados acima do esperado (pela diferença de força), acessos, títulos, boas campanhas em copas,
  jovens revelados e vendidos caro, objetivos cumpridos. Desce com demissão, rebaixamento, sequências de derrotas e
  objetivos não cumpridos.
- Fórmula única em `lib/tp/career/reputation.ts`, com teste: ganhar a Série D com o pior orçamento rende mais que
  ganhar com o melhor.
- Exibida como número + selo (Desconhecido, Local, Regional, Nacional, Continental, Mundial).

### 10.3 Propostas de emprego e demissão

- Clubes com vaga (técnico demitido pela IA ou fim de contrato) avaliam técnicos por reputação, histórico e estilo.
- Propostas chegam pela caixa de entrada, com escudo, salário, duração, orçamento, **objetivos** e promessas (ex.:
  verba para reforços). O técnico aceita, recusa ou negocia salário, duração e verba.
- Sondagens antes da proposta formal ("o clube X tem interesse").
- **Diretoria:** confiança 0–100 por objetivo (liga, copa, finanças, base). Confiança baixa leva a aviso e depois a
  demissão. Desempregado, o técnico recebe propostas compatíveis (ou de clubes menores) com o tempo.
- Sair no meio do contrato: multa e impacto na reputação, conforme o caso.

### 10.4 Finanças do clube

- Receitas: bilheteria (estádio × público × divisão), sócios, TV por divisão, premiações, vendas, patrocínio.
- Despesas: salários, bônus, manutenção do CT e do estádio, base, olheiros.
- Orçamentos de transferência e de salários definidos pela diretoria (ajustáveis por negociação).
- Clube endividado: mercado limitado e venda forçada.

### 10.5 Transferências e negociação (estilo FM)

1. **Olheiros** descobrem jogadores; os atributos aparecem como faixa de incerteza até serem observados.
2. **Proposta ao clube:** valor, parcelas, bônus por metas, % de revenda, troca por jogador, empréstimo (com opção de
   compra). O clube aceita, recusa ou faz contraproposta (IA com limites e "paciência").
3. **Negociação com o jogador**, depois do aceite do clube: salário, duração, **papel no elenco** (estrela,
   titular, rodízio, reserva, promessa), bônus (por jogo, gol, título), multa rescisória, aumento em caso de acesso.
   O jogador pesa a reputação do técnico, o tamanho do clube, o papel, o salário, a divisão e a idade. Promessa
   quebrada derruba a moral, e ele pede para sair.
4. Janelas de transferência por país; jogadores livres a qualquer momento.
5. Renovações; jogadores pedindo aumento; propostas recebidas de outros clubes.
6. A IA dos outros clubes compra, vende e empresta (só nos países carregados), com orçamento próprio.

### 10.6 Tática: imersão completa

Base: o que o Prancheta já tem (formações, postura, marcação, passe, linha, amplitude, ritmo), **mais**:

- **Funções por posição** (goleiro líbero, zagueiro construtor, lateral apoiador, volante destruidor ou construtor,
  meia armador, ponta invertido, centroavante pivô ou finalizador…), com os atributos-chave destacados na tela.
- **Instruções de equipe:** pressão (baixa/média/alta), contra-ataque, jogo pelos lados ou pelo meio, chutes de
  fora, segurar o resultado, foco em bola parada.
- **Instruções individuais** simples (marcar homem a homem, chutar mais, ficar mais atrás).
- **Bola parada:** batedores de pênalti, falta e escanteio; capitão.
- **Até 3 táticas salvas** (A/B/C), trocadas ao vivo com o mesmo "rascunho + Salvar" da partida do Prancheta.
- **Familiaridade** com a tática: cresce com treino e jogos; tática nova rende menos no começo.
- **Encaixe** de cada jogador na vaga (verde/amarelo/vermelho), reaproveitando `fitLevel`.
- **Relatório do adversário** antes do jogo: formação provável, pontos fortes, jogadores perigosos.

### 10.7 Jogadores

- **Atributos 1–20:**
  - técnicos: finalização, passe, cruzamento, drible, desarme, cabeceio, técnica, bola parada;
  - mentais: decisão, posicionamento, visão, determinação, trabalho em equipe, agressividade, liderança, frieza;
  - físicos: velocidade, aceleração, resistência, força, agilidade;
  - goleiro: reflexos, posicionamento, jogo aéreo, saída do gol, reposição.
- **Ocultos:** potencial, consistência, propensão a lesão, ambição, lealdade, profissionalismo.
- **Derivados (exibidos):** overall **por posição**, valor de mercado, salário esperado.
- **Estado:** condição física, moral, forma (média das últimas notas), lesões (tipo e dias), suspensões.
- **Evolução:** idade, potencial, minutos jogados, treino, nível do CT e o atributo de desenvolvimento do técnico.
  Declínio depois dos ~30 (físicos primeiro). Aposentadoria por idade e atributos.
- **Personalidade:** afeta negociação, moral e resposta às conversas.

### 10.8 CT, treino e base

- **CT:** níveis 1–10 (treino, base, departamento médico), melhorias pedidas à diretoria (custam caixa e tempo de
  obra).
- **Treino semanal:** foco (físico, tático, técnico, bola parada, recuperação) e intensidade (evolução × risco de
  lesão). Treino individual (nova posição, atributo específico).
- **Base:** todo ano chega uma leva de jovens gerados da semente; a qualidade depende da base, da reputação do clube
  e do país. Promover, emprestar ou dispensar.
- **Staff:** auxiliar técnico (sugere escalação e tática), preparador físico, fisioterapeuta, olheiros, treinador de
  goleiros, com salário e atributos 1–20.

### 10.9 Vestiário

- Conversas com jogadores (elogiar, cobrar, prometer minutos, falar de contrato) e com o grupo (antes do jogo, no
  intervalo, depois do jogo), reaproveitando o intervalo da partida ao vivo.
- Moral do grupo, líderes do elenco, grupinhos simples (mesma nacionalidade ou idioma).

### 10.10 Competições e calendário

- Ligas com acesso e rebaixamento nos formatos reais (grupos + mata-mata na Série D; grupos e playoffs nas divisões
  espanholas), copas nacionais (ida e volta ou jogo único, conforme o pacote), supercopas e continentais.
  Tudo descrito no `index.json`; **nenhuma regra de competição escrita no código**.
- Calendário diário: dias de jogo e de treino, janelas de transferência, datas FIFA (convocações tiram jogadores).
- Critérios de desempate configuráveis por competição.

### 10.11 Caixa de entrada, notícias e histórico

- A caixa de entrada é o centro do jogo: propostas, lesões, diretoria, olheiros, jogadores pedindo conversa, e a
  mensagem semanal do Prancheta Online (`inbox`).
- Notícias geradas por modelos de texto (resultados surpreendentes, artilheiros, demissões, transferências), com
  notas do online intercaladas (`news`).
- Histórico: carreira do técnico (clubes, títulos, % de vitórias), campeões, recordes do clube, **Hall da Fama**.

---

## 11. Telas (com os espaços de divulgação)

Identidade idêntica ao Prancheta, **mobile-first**, sem rolagem lateral, menu inferior no celular e lateral no
computador. Escudos reais em todas as telas (componente `Crest`).

| Tela | Conteúdo | Divulgação |
|---|---|---|
| Landing pública `/temporadas` | O que é, imagens do jogo, "Jogar grátis" (convidado ou login) | `landing` |
| Criação do técnico → escolha do país e do clube | Lista de clubes de divisões baixas com escudo, orçamento, expectativa | `loading` |
| **Sede (tela inicial)** | Cabeçalho com escudo e nome do clube, reputação, data e caixa; cartão "Próximo jogo" com os dois escudos; atalhos (Elenco, Tática, Mercado, Caixa de entrada, Clube/CT, Competições, Calendário, Finanças, Carreira); botão grande **Continuar** | `home-hero`, `home-side`, `nav-online` |
| Elenco e ficha do jogador | Lista + atributos, histórico, contrato | `nav-online` |
| Tática | Campo com funções, encaixe e instruções; táticas A/B/C | `nav-online` |
| Partida ao vivo | Componentes do Prancheta (placar, narração com escudos, câmera, estatísticas, mudanças) | `match-pre`, `match-half`, `match-end` |
| Mercado, olheiros e negociação | Busca, relatórios, diálogo de proposta e contraproposta | `market` |
| Caixa de entrada e notícias | Mensagens e notícias | `inbox`, `news` |
| Competições | Tabelas, chaveamentos, artilharia, com escudos | `nav-online` |
| Calendário, finanças, CT/base/staff | Telas de gestão | `nav-online` |
| Carreira e histórico | Cargos, títulos, reputação, Hall da Fama | `career` |
| Fim de temporada | Resumo da campanha e da carreira | `season-end`, `milestone` |
| Configurações | Salvar na nuvem, conta, créditos e fontes dos dados (atribuições da seção 8.1) | `nav-online` |

**Ilustrações:** quando faltar arte (fundo da sede, cartões de divulgação, ícones de telas novas), a IA escreve os
prompts no estilo do Prancheta e o dono gera as imagens (padrão do projeto).

---

## 12. Desempenho no aparelho

| Meta | Valor |
|---|---|
| Abrir o jogo (save local, dados em cache) | ≤ 1,5 s no celular médio |
| "Continuar" sem jogo / com rodada | ≤ 100 ms / ≤ 400 ms (worker) |
| Partida ao vivo | igual ao Prancheta otimizado: narração, estatísticas e escudos em `memo`; o quadro só redesenha o que mudou |
| Escudos | WebP 48 px nas listas, 128 px nos destaques, `loading="lazy"`, cache do service worker |
| Memória | ≤ 150 MB com 3 países carregados |
| Listas grandes (mercado com milhares de jogadores) | virtualizadas; filtros no worker |

---

## 13. Fases de entrega

| Fase | Entrega | Aceite |
|---|---|---|
| 0 | Esqueleto: rotas `/temporadas`, `lib/tp`, worker, IndexedDB, migração + bucket, `tp_commit`, salvar e carregar na nuvem; `PromoSlot` com `home-hero` e `nav-online` | Linha em `tp_saves` ≤ 300 B; arquivo no bucket; conflito entre 2 abas detectado; divulgação visível na sede |
| 1 | Scripts de dados (Wikidata → planilhas → pacote), validador, `build-logos`; 1 país completo; criação do técnico e escolha do clube; liga simulada | Temporada inteira simulada; tabela correta; save ≤ 10 KB; relatório de escudos sem pendências |
| 2 | Partida ao vivo com escudos reais na narração, tática estendida e atributos completos no motor; `match-*` | Teste de coerência tática; testes do online intactos |
| 3 | Elenco, condição, moral, lesões, treino, evolução, base | 10 temporadas sem erro; save ≤ 20 KB |
| 4 | Mercado: olheiros, proposta ao clube, negociação com o jogador, IA de transferências, contratos; `market` | Contraproposta funcionando; promessa quebrada afeta a moral |
| 5 | Carreira: reputação, diretoria, demissão, propostas de emprego, licenças; `career`, `milestone`, `season-end` | Técnico vencedor recebe propostas melhores; demitido recebe propostas menores |
| 6 | Copas nacionais e continentais, 2º país, notícias, caixa de entrada completa; `inbox`, `news` | Formatos vindos só do `index.json` |
| 7 | Landing, PWA offline, todos os espaços de divulgação, medição `ref` no online, painel admin, créditos | Jogo abre sem internet; os 14 espaços da seção 4.2 aparecem nas frequências definidas; conversões visíveis no admin |

---

## 14. Testes obrigatórios

- **Determinismo:** mesma semente + mesmas decisões → mesmo save (mesmo hash).
- **Save:** ida e volta (codificar → comprimir → descomprimir → decodificar) sem perda; migrações de formato.
- **Tamanho:** save após 1 e 10 temporadas dentro das metas (o build falha se passar).
- **Banco:** script que mede os bytes por linha de `tp_saves` (≤ 300 B) e confere que nenhuma outra tabela foi
  criada para o Temporadas.
- **Dados:** validador do pacote (ids únicos, todo jogador com clube, todo clube com competição, escudo existente ou
  reserva gerada).
- **Competições:** cada formato do `index.json` gera calendário válido (todos jogam o número certo de jogos).
- **Motor:** testes atuais do Prancheta passando; teste de coerência tática.
- **Divulgação:** cada espaço aparece onde e quando deve; nenhum bloco impede jogar; todo botão leva ao online com
  `ref` e `slot`.
- **Interface:** celular (390 px) e computador (1440 px) sem rolagem lateral e sem erros no console.

---

## 15. Fora de escopo (por enquanto)

Multiplayer, rankings entre usuários, chat, editor completo de banco de dados dentro do jogo, narração por voz,
partidas em 3D, monetização no Temporadas, anúncios de terceiros.
