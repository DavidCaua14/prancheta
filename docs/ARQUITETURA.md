# Prancheta — arquitetura

Objetivo: um manager de futebol online (estilo os clássicos dos anos 90), leve o
suficiente para rodar no navegador do celular e barato para hospedar com muitos
jogadores ao mesmo tempo.

## Princípios

1. **A partida é uma seed, não um vídeo.** O motor de simulação é determinístico:
   `simular(seed, timeCasa, timeFora, táticas) → lances`. O banco guarda só a
   seed, as escalações/táticas usadas e o placar final. Qualquer celular
   recalcula os lances localmente para "assistir" ou "reassistir" o jogo.
   Nada de gravar centenas de eventos por partida.
2. **Regras no código, não no banco.** Raridades, limites de nível/overall,
   divisões, copas e fórmulas ficam em `lib/game-config.ts` (compartilhado por
   cliente e servidor). O banco guarda só o que muda por usuário.
3. **Mudanças de tática viram "eventos de prancheta".** Ao assistir ao vivo, o
   técnico pode mudar tática/substituir. Cada mudança é um registro pequeno
   `(partida, minuto, mudança)`. A simulação é refeita a partir da seed + essas
   mudanças, então continua determinística.
4. **Rodadas com hora marcada, processadas em lote.** Um job agendado (cron)
   pega todas as partidas da rodada, simula e grava o resultado em lote. Quem
   está assistindo recebe a mesma seed e acompanha no relógio do servidor.
   Se o técnico estiver offline, vale a última escalação salva.
5. **Páginas estáticas sempre que possível.** Landing, regras e tabelas públicas
   são pré-renderizadas e servidas por CDN. Só o que é do usuário é dinâmico.
6. **Pouco JavaScript no cliente.** Componentes de servidor por padrão; só o que
   é interativo (simulação, leilão, escalação) vira componente de cliente.
   Arte 100% SVG/CSS — nenhuma imagem pesada para baixar.

## Atualização obrigatória do jogo

- No build, `next.config.ts` define a versão (`APP_VERSION`, ou SHA do commit
  na Vercel/git) e a embute no bundle (`NEXT_PUBLIC_APP_VERSION`).
- `GET /api/version` devolve a versão publicada e as notas da versão
  (`lib/version.ts → RELEASE_NOTES`). É estático: custo zero.
- `components/system/UpdateWatcher.tsx` consulta essa rota a cada 60 s e quando
  a aba volta ao foco. Se a versão do servidor for diferente, trava a tela com
  o aviso "Apito! Tem atualização" e o único botão recarrega o jogo.
- `deploymentId` também está configurado, então navegações entre versões
  diferentes forçam recarga completa (proteção contra "version skew").

**A cada deploy:** atualize `RELEASE_NOTES` em `lib/version.ts`.

## Cartas

| Raridade | Overall inicial | Overall máx | Nível máx | Limite no elenco |
| -------- | --------------- | ----------- | --------- | ---------------- |
| Base     | 45–60           | 70          | 10        | sem limite       |
| Destaque | 58–68           | 79          | 20        | 8                |
| Épica    | 66–76           | 89          | 35        | 4                |
| Especial | 74–84           | 99          | 50        | 2                |

Valores em `lib/game-config.ts` — ajuste lá e tudo (site e jogo) acompanha.
A carta guarda só `seed visual`, raridade, posição, atributos base, nível e XP;
o overall atual é calculado.

## Divisões e copas

Várzea → Série D → Série C → Série B → Série A → Liga das Lendas.
Todo clube novo entra numa liga da Várzea com vaga aberta (ligas são criadas
sob demanda quando as existentes enchem). Copas liberadas por divisão.

## Login e clube (implementado)

- **Login só com Google**, feito pelo navegador com o Supabase Auth (fluxo PKCE).
  A sessão fica salva no aparelho; não há servidor nosso no meio. Passo a passo das chaves: `docs/LOGIN-GOOGLE.md`.
- **Páginas estáticas** (`/entrar`, `/auth/callback`, `/clube/novo`, `/jogo`): saem da CDN da Vercel e
  conversam direto com o Supabase. Zero função de servidor por acesso.
- **Tabela `clubs`** (`supabase/migrations/0001_clubs.sql`): uma linha por usuário, ~100 bytes.
  `id` = id do usuário (garante 1 clube por conta), nome único (sem diferenciar maiúsculas), sigla, e escudo/camisa
  como **códigos curtos** (`lib/club/identity.ts`) desenhados em SVG no navegador.
- **Segurança no banco (RLS)**: só logados leem; cada um cria apenas o próprio clube; nome não pode ser trocado;
  escudo e camisa só pelo dono. Regras de formato também ficam no banco (CHECK).
- **Cache local**: depois do primeiro acesso, o clube vem do `localStorage` — abrir o jogo não lê o banco.
- **Rascunho local**: o que o jogador montou na criação do clube fica salvo no aparelho até ele fundar.

Estimativa no plano grátis (500 MB): o próprio Supabase guarda ~1–2 KB por usuário em `auth.users`;
a tabela `clubs` soma ~0,1 KB. Ou seja, dezenas de milhares de técnicos cabem com folga.

## Peneira — elenco inicial (implementado)

- **Cartas não ficam no banco.** `lib/cards/generate.ts` gera uma carta Base a partir de uma seed
  `hash(id do clube, vaga, opção)`: nome, posição, atributos, overall (45–60), idade, pé e visual.
  Mesma seed → mesma carta, em qualquer aparelho. Gera 28 mil cartas em ~55 ms.
- **Vagas** (`lib/cards/squad.ts`): 11 titulares no 4-3-3 (3 opções cada) + 3 reservas (5 opções cada).
- **No banco**: coluna `clubs.squad` = `"1:"` + 14 dígitos com a opção escolhida em cada vaga (16 bytes).
  O CHECK só aceita opções que existem (0–2 nos titulares, 0–4 nas reservas) e um gatilho impede refazer a
  peneira depois de confirmada (`supabase/migrations/0002_squad.sql`). Como as opções são fixas por clube,
  recarregar a página não sorteia de novo.
- **Uma escrita só**: o progresso fica no aparelho e o elenco vai para o banco ao confirmar.
- O prefixo `1:` é a versão do gerador. ⚠️ Nunca mude a lógica da v1: isso trocaria as cartas de todos.
  Para evoluir, crie a v2 e mantenha a v1 para quem já tem elenco.

### Evolução das cartas

Implementada como planejado: só o XP de cada carta do elenco (`clubs.xp`, 14 números) — ver a seção
"Evolução das cartas" mais abaixo. Cartas que chegarem de fora (leilão, prêmios) vão para uma tabela
pequena, referenciadas pela seed.

## Escalação e tática (implementado)

- Tela `/escalacao`, inspirada no Brasfoot: lista de jogadores (titulares por vaga + reservas), 14 formações
  (4-3-3, 4-4-2, 3-5-2, 4-5-1, 5-3-2, 3-4-3, 4-2-3-1, 4-1-4-1, 4-4-2 losango, 4-2-2-2 quadrado mágico, 4-2-4,
  5-4-1, 3-4-1-2, 4-3-2-1 árvore de Natal — caractere da formação em base 36, migração 0004), escalação automática, campinho com o rendimento na vaga e força por
  setor (DEF/MEI/ATA).
- **Fora de posição rende menos** (`lib/tactics/formations.ts`): 100% na posição, ~80–90% em posições
  parecidas (amarelo), 60–75% improvisado (vermelho) e 30% para goleiro na linha ou jogador no gol.
- **Tática** (`lib/tactics/lineup.ts`): postura (retranca → tudo pra frente), marcação (leve/normal/pressão),
  passes (toque curto/misto/ligação direta), capitão e cobrador de pênaltis. Os efeitos entram no motor de
  simulação.
- **No banco**: `clubs.lineup` = `"1:F:XXXXXXXXXXX:PMS:CK"` (~23 bytes), validado pela função `lineup_ok`
  (11 titulares diferentes, capitão e cobrador entre eles). Jogador fora de posição é marcado no campinho
  (anel + "!"), na lista (etiqueta adaptado/improvisado) e num aviso com quanto ele perde. 1 escrita a cada "Salvar"
  (`supabase/migrations/0003_lineup.sql`). Sem escalação salva, vale o 4-3-3 da peneira.

## Motor de partidas (implementado)

- `lib/sim/engine.ts`: simulação minuto a minuto, **determinística** (seed + times + mudanças → mesma partida).
  Narração com sorteio separado (`lib/sim/narration.ts`): mudar frases nunca muda resultados.
- A cada minuto: o meio-campo disputa a posse; quem tem a bola pode atacar (ataque × defesa → chute); o chute
  depende de finalização × goleiro. Também: contra-ataques (quem se lança deixa espaço), escanteios e cabeçadas,
  faltas, cartões, pênaltis (cobrador escolhido), lesões, cansaço, expulsões e substituições.
- Pesam: atributos, encaixe de posição, formação (cobertura por setor), postura, marcação, passes, mando de campo,
  "dia" de cada jogador, cansaço e jogadores a menos.
- `changes`: mudanças do técnico durante o jogo (postura, marcação, passes, substituições) a partir de um minuto.
  Recalcular com as mudanças não altera nada antes delas.
- IA do técnico (`ai: true`): substitui cansados e ajusta a postura pelo placar.
- Saída: placar, lances narrados, estatísticas e notas dos jogadores (base para XP).
- Constantes em `TUNING`; ⚠️ mudar regras altera partidas antigas → subir `ENGINE_VERSION`.

### Equilíbrio (testado)

`npm test` roda 13 testes (regras, determinismo e equilíbrio com milhares de jogos) e `npm run sim:balance`
imprime o relatório completo. Números atuais (times Base sorteados):

| Métrica | Motor | Referência real |
| --- | --- | --- |
| Gols por jogo | ~2,7 | 2,5–2,8 |
| Mandante / empate / visitante | ~45% / 25% / 30% | 45% / 27% / 28% |
| 0 x 0 | ~6% | 7–8% |
| Chutes por time / no alvo | ~12,8 / 34% | 12 / 33% |
| Amarelos / vermelhos / pênaltis por jogo | 3,1 / 0,15 / 0,3 | 3–4 / 0,15 / 0,25 |

- Força: +5 de overall vence ~55% (perde ~23%), +10 vence ~72%, +20 vence ~95%.
- Postura: nenhuma domina; mais ofensiva = mais gols nos dois lados; retranca = mais empates e é a melhor
  escolha do time mais fraco contra o mais forte.
- Marcação pressão: leve vantagem, quase o dobro de cartões e mais cansaço.
- Passes: time técnico rende mais no toque curto; time rápido, na ligação direta.
- Todas as 14 formações ficam competitivas (33–42% de derrotas contra o 4-3-3).

### Amistoso de treino

`/partida`: jogo contra o rival gerado do clube, rodando o motor no aparelho (nada vai para o banco), com
narração, velocidade 1x/2x/4x, pausa no intervalo, troca de postura e substituições durante o jogo.

## Liga da Várzea (implementado)

- **Formato**: grupos de 10 clubes, turno e returno (18 rodadas). Rodadas às 8h, 10h, 12h, 14h, 16h, 18h, 20h e 22h
  (Brasília) → 8 jogos por dia, temporada de ~2,5 dias. 1 minuto de jogo = 6 s (jogo de ~9,5 min ao vivo).
- **Vagas da CPU**: a liga nasce cheia; vagas sem técnico são times da CPU gerados no aparelho
  (`lib/league/bots.ts`). Quem chega **assume a vaga de um time da CPU** (com a campanha dele, como um técnico que
  pega o clube no meio do campeonato) e joga já na próxima rodada.
- **`join_league()`** (função no banco): mantém o clube na liga atual; senão procura uma liga com vaga e ≥ 6
  rodadas pela frente (preferindo a que tem mais humanos, para os técnicos se encontrarem); senão cria uma nova
  com a 1ª rodada no próximo horário.
- **Nenhum placar no banco**. O aparelho calcula tudo (`lib/league/data.ts`) a partir de:
  `league_rounds` (horários), `clubs.league_slot/joined_round` (quem ocupa cada vaga),
  `lineup_log` (escalação em vigor no apito — gravada por gatilho a cada "Salvar") e
  `match_changes` (mudanças ao vivo). Como o motor é determinístico, todos veem os mesmos resultados e
  ninguém consegue gravar um placar falso. Temporada inteira (90 jogos) = ~55 ms.
- **Ao vivo**: o técnico muda postura e faz substituições durante o jogo; a mudança vale 4 minutos de jogo
  depois (24 s), para chegar a todos os aparelhos. O banco recusa mudança para minuto que já passou e em time
  alheio (`match_change_ok`). O aparelho relê as mudanças a cada 10 s só durante as rodadas.
- **Custo**: por liga, ~18 linhas de horários + 1 linha de escalação por "Salvar" + mudanças ao vivo
  (só quando alguém mexe). Leituras: 5 consultas pequenas ao abrir a liga.

## Divisões: da Várzea à Liga das Lendas (implementado)

- **Regras** (`lib/league/divisions.ts`, espelhadas em SQL em `division_rules()`):
  Várzea → os **4 primeiros sobem** para a Série D. Série D → **4 sobem** para a C e os **3 últimos caem**
  para a Várzea. Série C → **4 sobem** para a B e os **3 últimos caem** para a D. Série B → **4 sobem** para a A e os
  **3 últimos caem** para a C. Série A → **4 sobem** para a Liga das Lendas e os
  **3 últimos caem** para a B. Liga das Lendas (o topo) → os **3 últimos caem** para a A; o 1º é o campeão
  do jogo. A pirâmide está completa: `clubs.division` vai de 0 a 5. Vale a posição da vaga — quem assumiu um time da CPU no
  meio da temporada leva a campanha dele.
- **Quem fecha a temporada é o servidor**: a Edge Function `close-league`
  (`supabase/functions/close-league/index.ts`) relê a liga, recalcula os 90 jogos com o **mesmo código do jogo**
  (`lib/league/core.ts`, código puro, sem navegador) e chama `close_league()` com a ordem final das vagas e os
  pontos. Só a `service_role` executa `close_league()`, então nenhum aparelho consegue inventar a própria
  classificação. É idempotente: liga já fechada só devolve o resultado.
- **Quando fecha**: o primeiro técnico daquela liga que abrir o jogo depois do fim (`ends_at`) dispara o
  fechamento; com a tela aberta, isso acontece sozinho. `join_league()` não deixa ninguém sair de uma liga
  encerrada sem fechar (erro `P0003`), exceto depois de 6 h — para ninguém ficar preso se algo falhar.
- **O que fica no banco**: `leagues.final` (10 caracteres) + `closed_at`, `clubs.division` e **uma linha por
  clube por temporada** em `club_seasons (pos, pts, move)`. Nada de placares.
- **Força da CPU por divisão** (mesmo formato em todas: 10 clubes, 8 rodadas/dia), OVR médio do time:
  Várzea 52,1 (escolha aleatória na peneira) · Série D 54,9 (sempre a melhor carta) · Série C 56,9 (melhor
  carta + 2 de overall) · Série B 58,9 (melhor carta + 4) · Série A 60,9 (melhor carta + 6) · Liga das Lendas 62,8 (melhor carta + 8). Cada degrau dá ~30% V / 25% E / 45% D para um time do nível de baixo — quem sobe
  entre os 4 primeiros chega competitivo, mas sente a subida. A CPU de divisões que já existem nunca muda
  (testado em `tests/league.test.ts`), porque ligas antigas são recalculadas.
- **Nova divisão** = uma linha em `LEAGUE_DIVISIONS`, nomes da CPU em `lib/cards/names.ts`, uma migração com
  `division_rules()` e republicar a função (`npm run fn:deploy`).
- **Fim de temporada no app**: aviso com posição, pontos e "Acesso!"/"Rebaixado" (`SeasonSummary`), visto uma
  vez por temporada (guardado no aparelho).
- **Publicar a função** (empacota `lib/` com esbuild e envia pela Management API):
  `SUPABASE_ACCESS_TOKEN=sbp_... npm run fn:deploy`. Só é preciso republicar quando mudar o motor, os times
  da CPU ou as regras da liga — e, nesse caso, junto com o deploy do site.

## Evolução das cartas (implementado)

- **O banco guarda só o XP**: `clubs.xp smallint[14]` (null = tudo zero). Nível e overall são derivados no
  aparelho (`lib/cards/evolution.ts`): cada nível = **+1 de overall e de cada atributo**, até o teto do tipo
  (Base: nível 10, overall 70). Custo do nível n → n+1: `50 + 25·(n−1)` XP (1.350 XP até o nível 10).
- **XP por jogo da liga** (`matchXp`): titular 6, entrou no jogo 4, banco 2 (treino); nota ≥ 7 +3, ≥ 8 +6;
  gol +4, assistência +2; vitória +3, empate +1. **Fim de temporada**: acesso +40 e título +60 para cada
  carta (somados em SQL).
- **Quando entra**: só no fechamento da temporada. A Edge Function `close-league` calcula o XP dos jogos de
  cada clube humano (`clubMatchXp`, o mesmo motor) e `close_league(..., p_xp)` soma, com teto de 3.000 por
  carta por temporada. Ninguém do lado do jogador consegue escrever em `xp` (sem grant de update).
  Por que só no fim? Os jogos da liga são recalculados por todos os aparelhos, então a força das cartas
  precisa ser a mesma do 1º ao último jogo da temporada.
- **No app**: o Elenco mostra a barra de XP de cada carta, o "XP a receber" da temporada em andamento
  (calculado no aparelho) e quais cartas vão subir de nível. O aviso de fim de temporada lista as cartas
  que evoluíram.
- **Ritmo** (média, sem bônus): titular ~157 XP por temporada, reserva ~57. Titular chega ao nível 3 na 1ª
  temporada e ao 10 em ~9 temporadas (~3 semanas). Elenco Base no nível 10 (OVR ~62 contra 53): V/E/D
  77/15/9% contra a CPU da Várzea, 42/24/34% contra a da Série A e 35/25/41% contra a das Lendas — o topo
  fica para as cartas Destaque, Épica e Especial.

## Esboço do banco (Postgres)

```
users(id, nome, criado_em)
clubs(id, user_id, nome, cores, escudo_seed, divisao_id, moedas)
cards(id, club_id, raridade, posicao, atributos jsonb, nivel, xp, visual_seed)
lineups(club_id, formacao, tatica, titulares int[])          -- 1 linha por clube
leagues(id, divisao_id, temporada, status)
league_clubs(league_id, club_id, pts, v, e, d, gp, gc)       -- tabela atualizada em lote
matches(id, competicao, rodada, casa_id, fora_id, inicio_em, seed, placar_casa, placar_fora, status)
match_changes(match_id, club_id, minuto, mudanca jsonb)       -- só se o técnico mexer
auctions(id, card_id, termina_em, maior_lance, maior_club_id)
bids(auction_id, club_id, valor, criado_em)                   -- opcional, pode ficar só o maior
friendlies(id, codigo, casa_id, fora_id, inicio_em, match_id)
```

## Próximos passos

1. ~~Autenticação e criação de clube~~ ✅
1. ~~Peneira: elenco inicial de cartas Base~~ ✅
1. ~~Escalação e tática~~ ✅
1. ~~Motor de simulação + amistoso de treino~~ ✅
1. ~~Liga da Várzea (8 rodadas/dia, ao vivo, CPU nas vagas livres)~~ ✅
1. ~~Acesso à Série D (Edge Function fecha a temporada)~~ ✅
1. ~~Série C~~ ✅
1. ~~Série B~~ ✅
1. ~~Série A~~ ✅
1. ~~Liga das Lendas~~ ✅
1. ~~Evolução das cartas (XP por jogo, bônus de acesso e título)~~ ✅
1. Cartas Destaque/Épica/Especial como prêmio e no leilão; copas.
2. Motor de simulação completo (`lib/sim/`) com testes de determinismo.
3. Tela de escalação/prancheta.
4. Ligas da Várzea + job de rodadas.
5. Tela de partida ao vivo usando o motor real.
6. Leilão.
7. Amistosos por link.
