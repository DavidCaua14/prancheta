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
  `lineup_log` (escalação em vigor no apito — gravada por gatilho a cada "Salvar"; lida pela RPC
  `lineup_log_window(clubes, início, fim?)`, que devolve por clube a última escalação até o início — por mais antiga
  que seja — e as seguintes; liga, copas, amistosos e as Edge Functions usam a mesma janela) e
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
  aparelho (`lib/cards/evolution.ts`). Custo do nível n → n+1: `50 + 25·(n−1)` XP (1.350 XP até o nível 10).
- **Potencial próprio de cada carta** (`cardPotential`): o teto da raridade (Base 70 / nível 10, Destaque 79 /
  20, Épica 89 / 35, Especial 99 / 50) é o **máximo possível**, não o destino de toda carta. Cada carta nasce
  com o seu nível máximo (entre metade do teto e o teto) e o overall que alcança nele. A nota de potencial
  (0–1) vem da idade (≤20 anos ~0,66 … ≥31 ~0,26) + sorteio (soma de 3, extremos raros), com seed própria
  (`potencial:<seed>:<key>`): igual em todo aparelho e no servidor, nada no banco, cartas já geradas não mudam.
  O ganho de overall se espalha do nível 1 ao nível máximo (`overallAtLevel`) e vale também para os atributos;
  toda carta ganha ao menos +2 (se houver espaço). Distribuição (2.000 cartas por raridade): chegam ao overall
  máximo ~1,3% das Base, ~1,1% das Destaque, ~0,8% das Épicas e ~0,6% das Especiais; ganho médio +8 (Base),
  +7,6 (Destaque), +8,5 (Épica), +9,4 (Especial); Base termina entre os níveis 5 e 10 (a maioria 7–8).
  A carta mostra "Nv 3/8 · Pot 63"; o leilão mostra o potencial (alto/médio/baixo) de cada lote.
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

## Leilão (implementado)

- **Reposição na hora** (`0026_auction_refill.sql`): carta arrematada antes do fim da rodada dá lugar à seguinte
  da mesma raridade. Índice = vaga + 12 × geração (vaga 3: 3, 15, 27…, até 20 gerações); `lotTier` usa a vaga
  (`idx % 12`). `place_bid` só aceita a geração g se a g−1 tem lance e fechou antes do fim da rodada;
  `currentLotIdx` escolhe o lote em exibição em cada vaga. Obs.: `P0004` (lote encerrado/não aberto) é o código
  `assert_failure` do Postgres — `when others` não o captura.
- **Potencial à vista**: cada lote mostra "Potencial alto/médio/baixo", overall hoje → máximo e nível máximo; a
  folha de lance tem o painel com barras contra o teto da raridade.
- **Arremate comemorado** (`WinReveal`): quando um lote que eu liderava fecha, a tela relê o resultado 1,5 s depois
  do fim e só então mostra "É sua!" (carta virando, selo ARREMATADO!, moedas caindo e o valor pago). Uma vez por
  carta por aparelho (`prancheta:arremates:<clube>`); na 1ª vez, só o que fechou nas últimas 6 h.
- **Lotes sem tabela**: a cada 2 h (rodada = `floor(epoch/7200)`, 24 h por dia) abrem **8 lotes**: 5 Destaque,
  2 Épica e o 8º é Especial a cada 4 rodadas (senão Destaque). A carta do lote sai de `(rodada, índice)` em
  `lib/auction/lots.ts` (`lotCard`) — o banco não guarda cartas.
- **Banco**: só `auction_lots (round, idx, best_club, best_amount, bids, ends_at)` — **1 linha por lote que
  recebeu lance**, atualizada a cada lance. `place_bid()` faz tudo numa transação: confere horário e lance
  mínimo (piso da raridade: 300 / 900 / 2.500, depois +5% e pelo menos +10), **tira as moedas** de quem deu o
  lance e **devolve** as do anterior e não deixa cobrir o próprio lance. **Cada lance novo marca o fim do lote
  para 10 minutos depois** (se faltava mais, cai para 10; se faltava menos, volta para 10): os outros técnicos
  sempre têm tempo de ver e cobrir. Lote sem lance fecha no fim da rodada; uma disputa pode passar do fim da
  rodada e aparece em "Ainda em disputa".
- **Sem "entrega"**: o lote com `ends_at` no passado é de quem deu o maior lance. O elenco é montado no
  aparelho: 14 cartas da peneira + arrematadas em ordem de arremate (índices 14, 15, …), **sem limite de
  cartas**. A escalação usa o código v1 (1 caractere por jogador) até 36 cartas e o v2 (2 caracteres, até
  1.296 cartas) quando escala alguém além da 36ª; `clubs.xp` acompanha o tamanho do elenco. Nos jogos da liga a
  carta só conta **depois do arremate** (`wonAt(..., apito)`), então nenhum resultado antigo muda.
- **Moedas** (`clubs.coins`, sem grant de update): 1.000 para começar + prêmio no fim de cada temporada
  (`season_prize`: 1º lugar ganha 300 na Várzea, 500 na D, 800 na C, 1.200 na B, 1.800 na A e 2.800 nas
  Lendas; o último leva 25% disso). O prêmio aparece no aviso de fim de temporada.
- **Raridades evoluem** com o mesmo XP: Destaque até nível 20 / overall 79, Épica 35 / 89, Especial 50 / 99.
- **Custo**: lances = 1 linha por lote disputado (no máximo 8 a cada 2 h, ~100 por dia). A tela relê só os
  lotes da rodada a cada 8 s enquanto está aberta.

## Copas — Várzea, Nacional, Supercopa e Copa das Lendas (implementado)

- **Formato**: mata-mata diário de 32 clubes, jogo único em campo neutro, empate vai para os pênaltis
  (`lib/cup/shootout.ts`, seed própria). Fases às 13h, 15h, 17h, 19h e 21h (Brasília) — horas ímpares, sem
  bater com a liga. Inscrição aberta a todos os clubes até 12h45 (depois, vale a edição do dia seguinte); as
  vagas sem técnico ficam com a CPU da Várzea.
- **Banco**: `cups` (1 linha por edição) e `cup_entries` (1 por inscrito, até 32) — nada de jogos ou placares.
  `join_cup()` escolhe a edição com mais humanos e sorteia a vaga. Mudanças ao vivo em `cup_changes`
  (`cup_change_ok`: só o próprio time, só minuto futuro, 30 por fase). Códigos de substituição: `xAB` ou
  `yAABB` (elenco com mais de 36 cartas — também passou a valer na liga).
- **Força congelada**: a inscrição guarda o XP das cartas; a copa inteira usa esse XP (a liga pode fechar no
  meio da copa e mudar o XP). Cartas do leilão contam a partir do arremate, como na liga.
- **Cálculo no aparelho** (`lib/cup/core.ts`): 1ª fase = vaga 0×1, 2×3...; depois, vencedor do jogo 2i × 2i+1.
  A tela só mostra os confrontos de uma fase quando a anterior terminou e os dados foram relidos depois disso
  (senão o "vencedor" seria calculado sem as últimas mudanças dos técnicos).
- **Fechamento**: a Edge Function `close-cup` recalcula o mata-mata e chama `close_cup()` (só service_role),
  que confere a chave (16/8/4/2/1/1 por fase), grava a fase alcançada e paga as moedas: campeão 300, vice 150,
  semi 80, quartas 40, oitavas 20. A copa **não dá XP** (mudaria a força das cartas no meio da liga).
- **Copa Nacional** (`kind = 1`, implementado): mata-mata diário de **64 clubes**, só da **Série C para cima**
  (`join_cup` recusa com `P0009`). Fases às 11h30, 13h30, 15h30, 17h30, 19h30 e 21h30 — meia hora depois da
  liga/Copa da Várzea, sem bater com elas; inscrição até 11h15. CPU no nível da Série C. Prêmios: campeão
  500, vice 300, semi 150, quartas 80, oitavas 40, 2ª fase 20. Um clube pode jogar as duas copas no mesmo dia.
- **Configuração**: `CUP_KINDS` (`lib/cup/core.ts`) espelhado em `cup_config()` e `cup_prize()` no SQL. Os
  times da CPU usam uma lista de nomes própria de cada copa, embaralhada por edição, sem repetir na chave.
- **Supercopa** (`kind = 2`, implementado): a copa dos campeões, **semanal, todo domingo**. Só entra quem
  terminou em **1º lugar** a temporada da sua divisão (qualquer divisão) numa temporada fechada nos **últimos
  7 dias** (`join_cup` recusa com `P0010`). 16 clubes: oitavas 14h30, quartas 16h30, semi 18h30, final 20h30
  (horários livres de liga e das outras copas); inscrição até 14h15 de domingo. CPU no nível da Série B com
  nomes da Série A e das Lendas. Prêmios: campeão 800, vice 400, semi 250, quartas 150, oitavas 100.
- **Copa das Lendas** (`kind = 3`, implementado): a copa da elite, **semanal, todo sábado**. Só clubes da
  **Liga das Lendas** (`join_cup` recusa com `P0009`). 32 clubes: 1ª fase 12h30, oitavas 14h30, quartas 16h30,
  semi 18h30, final 20h30 (horas pares e meia — livres da liga, das copas diárias e da Supercopa, que é no
  domingo); inscrição até 12h15 de sábado. CPU no nível das Lendas, com nomes das Lendas e da Série A.
  Prêmios: campeão 1.000, vice 500, semi 250, quartas 150, oitavas 100, 1ª fase 50 (todo mundo leva algo —
  chegar lá já é mérito). Migração `0022_copa_lendas.sql`; `close-cup` republicada com o novo `CUP_KINDS`.
- **Copa nova**: um `kind` em `CUP_KINDS` + `cup_config()`, `cup_prize()` e a lista de `join_cup()` no SQL, e
  republicar a `close-cup` (ela usa `CUP_KINDS` para montar a CPU — sem isso a chave da CPU sairia errada).

## Estrutura do clube (implementado)

- **Três estruturas** (nível 0–5, `clubs.facilities smallint[3]`; espelho em `lib/club/facilities.ts`):
  Estádio (bilheteria, +10% por divisão) — custos 400/900/1.500/2.300/3.300, renda 8→40 por jogo; Lanchonete
  (fixa) — 200/450/750/1.100/1.600, renda 4→20; Loja oficial (+20% por divisão) — 350/750/1.300/2.000/3.000,
  renda 5→25. Nível 0 não rende: é preciso investir. Tudo no máximo: ~20 mil moedas; rende 85 por jogo em casa na
  Várzea e 130 nas Lendas (9 jogos em casa por temporada) — se paga em ~26 temporadas na Várzea (meta de longo prazo).
- **Só jogos da liga como mandante** (copa = campo neutro; amistoso não vale, para não combinar com amigo).
  O servidor confere o mando pela tabela (`league_home_slots`, espelho de `doubleRoundRobin`, conferido nas 18
  rodadas) e paga uma vez por jogo (`home_income`, PK clube+liga+rodada), 10 min depois do apito.
- **Recebimento**: `collect_home_income()` ao abrir a sede (aviso "+N moedas") e no fim do jogo em casa
  (`HomeIncomeCard` com bilheteria/lanchonete/loja); `upgrade_facility(k)` recebe o pendente no nível antigo antes
  de subir; gatilho `clubs_pay_home_income` paga o pendente da liga antiga quando o clube troca de liga. Jogo com
  estrutura zerada fica registrado com 0 (investir depois não paga jogo antigo).
- **Aba Clube** (`ClubTab`): identidade (escudo, divisão, uniforme), moedas / renda por jogo / títulos, as três
  obras com níveis e "rende hoje → próximo nível", últimos jogos em casa, história (temporadas, acessos, títulos,
  melhor campanha) e conta. Arte opcional: `facility-<estadio|lanchonete|loja>` ou `-<nível>`.

## Ranking entre técnicos (implementado)

- **Só clubes reais** (a CPU não fica na tabela `clubs`). RPC `ranking(semana, limite)` (`0028_ranking.sql`) calcula
  na hora a partir do que o servidor já gravou — ninguém forja pontos:
  liga (× divisão: Várzea ×1, D ×1,25, C ×1,5, B ×2, A ×2,5, Lendas ×3) = **vitória 10**, empate 3, goleada (3+
  gols) +5, título +150, acesso +75; copa (× copa: Várzea ×1, Nacional ×1,5, Supercopa ×2, Lendas ×3) = cada fase
  vencida 15, campeão +60 (`0029_ranking_wins.sql`; vitórias/empates/goleadas vêm de `club_seasons`/`cup_entries`,
  gravados no fechamento). "Semana" = só o que fechou nos últimos 7 dias. Desempate: divisão atual, títulos.
  Devolve o top N e sempre a linha de quem pergunta (`me`). Com muitos clubes, materializar (hoje é barato).
- **Telas**: `/ranking` (pódio do top 3, tabela até o 50º, sua linha fixa embaixo quando está fora, abas Geral e
  Semana, "Como pontua") e o atalho na sede com a sua posição e o líder. Arte opcional: `icon-ranking`.

### Ranking jogo a jogo (implementado)

- **Pontua logo depois de cada partida** (`0030_match_points.sql`): a Edge Function `score-round` recalcula a rodada
  da liga (ou fase da copa) com o mesmo motor assim que ela termina (apito + 10 min) e grava o resultado de cada
  técnico real em `match_points` (V/E/D, gols, goleada, passou de fase) via `record_rounds` (só service_role);
  `scored_rounds` garante uma gravação por rodada. Quem dispara: o aparelho de quem está na liga/copa
  (`useAutoScore` em `useLeague`/`useCup`: recupera rodadas encerradas ao abrir e agenda o fim de cada rodada) e,
  como rede de segurança, `close-league`/`close-cup` gravam tudo o que ficou de fora. Cálculo em `lib/scoring.ts`
  (conferido: os números jogo a jogo batem com o que o fechamento grava em `club_seasons`).
- **Fim de jogo** (`RankingPointsCard`, liga e copa): ~10 min após o apito inicial pede a pontuação, lê a linha de
  `match_points` e mostra "+N" com a conta (vitória/empate/goleada/fase × divisão ou copa, `matchRankPoints`, espelho do
  SQL) e a subida (`rank_climb`, `0031_rank_climb.sql`: posição antes do jogo — minha pontuação sem os pontos dele
  contra a atual dos outros —, posição agora e até 3 ultrapassados; `club_scores` concentra a conta do ranking).
  Animação (`RankClimb`): o número rola do lugar antigo ao novo, a seta pula, os escudos ultrapassados entram um a
  um; sem animação para quem pede menos movimento.
- **Ranking** = jogos (vitória 10, empate 3, goleada +5 × divisão; fase de copa 15 × copa) + bônus no fechamento
  (título +150, acesso +75 × divisão; campeão de copa +60 × copa). "Semana" usa a hora do jogo.

## Teste de carga: temporada completa com 50 técnicos (feito)

Roteiro fora do repositório: 50 contas de teste agindo pela API pública com a sessão de cada uma (como o app),
relógio das ligas/copas adiantado no banco para jogar uma temporada inteira. Achados e correções:

- **Corrida na última vaga** (`0032_join_race.sql`): dois técnicos entrando juntos — o segundo ficava na liga
  **sem vaga** (não jogava). Agora tenta de novo; e o banco exige vaga quando há liga (`clubs_league_slot_check`).
- **Edições duplicadas** (`0033_join_lock.sql`): 15 inscrições simultâneas sem copa aberta criavam 8 copas com 1
  clube. `join_league`/`join_cup` passam por um bloqueio curto por divisão/tipo de copa (50 juntos: 32 + 18, ~1 s).
- **Ranking jogo a jogo**: 50 técnicos abrindo juntos pediam rodada por rodada (778 chamadas, 20 s). Agora 1 pedido
  grava todas as rodadas encerradas que faltam e sai na hora se já está tudo gravado (3,3 s, mesmo resultado).
- **Conferido**: ordem final do servidor = a do aparelho nas 6 ligas; acessos (4 por liga na Várzea), prêmios, XP,
  copas (930 moedas = tabela), leilão (carta escalada), amistoso ao vivo, renda em casa (nada pago 2×) e o caixa
  inteiro (25.000 − obras − leilão + prêmios + renda = saldo final, exato). Telas com dados reais: sem erros.
- **Tela de eventos** (`0034_pending_stats.sql`): o "a confirmar" vinha de baixar a liga e cada copa e recalcular tudo
  no aparelho, em cascata (~2,8 s). Agora `my_pending_stats()` soma o resultado gravado jogo a jogo (`match_points`) das
  competições em andamento, numa consulta; as leituras saem em paralelo, o clube vem do cache do aparelho e a lista
  de eventos é lida uma vez por sessão (~0,9 s com 150 ms por consulta). Teste confere: mesma soma do cálculo antigo.
- **Tempos** (50 simultâneos): leituras e RPCs ~0,1–0,5 s; fechar liga ~2,5 s; fechar copa ~1,3 s; cálculo da
  temporada no aparelho ~60 ms.

## Amistosos entre amigos (implementado)

- **Fluxo**: em `/amistosos` o técnico escolhe o horário (em 5 min, 15 min, 1 h, ou dia + hora de Brasília, de
  2 min a 7 dias) e recebe um código (`PALAVRA-XXXX`, ex.: `RESENHA-7K2Q`) e o link `/amistosos?c=CÓDIGO`, com
  botões de copiar, WhatsApp e compartilhar. O amigo abre o link, vê o convite e aceita até 30 s antes do apito.
  Sem login, o link fica guardado (`prancheta:convite`) e a sede (`/jogo`) volta para ele depois de entrar e
  montar o clube. Também dá para digitar o código na tela.
- **Jogo**: `/amistosos/jogo?id=N` usa a mesma `LiveMatch` da liga e das copas (câmera, tática, substituições).
  Quem convida é o mandante; empate é empate. Vale a escalação salva no apito; a força (XP) fica congelada no
  aceite; cartas do leilão contam se arrematadas até o apito. Mudanças ao vivo em `friendly_changes` (30 por
  clube, só minuto futuro); relidas a cada 10 s durante o jogo.
- **Banco** (`0023_friendlies.sql`): `friendlies` (1 linha por amistoso) e `friendly_changes`. RPCs
  `create_friendly` (limite de 5 amistosos por jogar por clube, `P0011`; faxina de convites vencidos e jogos com
  mais de 30 dias), `friendly_invite` (lê o convite pelo código), `accept_friendly` (`P0012` é seu, `P0013` já
  aceito, `P0014` expirou) e `leave_friendly` (quem marcou cancela; quem aceitou desiste). RLS: cada clube só lê
  os próprios amistosos — convite alheio só pelo código.
- **Cálculo no aparelho** (`lib/friendly/core.ts`): sem Edge Function — amistoso **não dá moedas, XP nem conta nos
  eventos** (nada para combinar entre amigos e "farmar"). A lista de resultados carrega os jogos encerrados em
  lote (4 leituras para até 10 jogos).
- **Correção** (`0024_lineup_window.sql`): antes, liga e copas liam só os últimos 11 dias de `lineup_log`; clube
  sem mexer na escalação há mais tempo jogava com a escalação automática. Agora vale sempre a última salva.

## Economia, loja e eventos (implementado)

- **Filosofia**: prêmios de liga e copa compram **cartas Base boas**; Destaque, Épica e Especial pedem
  **paciência** (juntar moedas nos eventos semanais) ou um **pacote da loja**. Quem joga muito evolui sempre;
  quem compra pacote tem acesso rápido a muitas moedas — essa é a vantagem dele.
- **Tudo em `lib/economy.ts`** (espelhado em SQL: `season_prize`, `cup_prize`, `auction_min`, default de `clubs.coins`).
- **Leilão (preço mínimo)**: Base 100 (4 lotes por rodada, a melhor de 3 cartas sorteadas) · Destaque 1.500 ·
  Épica 5.000 · Especial 15.000. Os 8 lotes raros (índices 0–7) não mudaram; os Base são os índices 8–11.
- **Prêmio de temporada**: 1º lugar 300 (Várzea) · 350 (D) · 400 (C) · 500 (B) · 600 (A) · 700 (Lendas),
  **+50% para o campeão** (450 a 1.050), caindo até 25% no último (Várzea: 75).
- **Copas**: Copa da Várzea até 300 · Copa Nacional até 500 · Supercopa 100 a 800 · Copa das Lendas 50 a 1.000.
- **Eventos semanais**: ~1.500 moedas por semana (6 missões).
- **Técnico ativo sem pagar nada**: ~2.300 moedas por semana (liga ~600 + copas ~200 + eventos ~1.500) →
  uma Destaque por semana, uma Épica em ~2 semanas, uma Especial em ~6–7 semanas. Começa com 500.
- **Loja** (`/loja`, só vitrine — pagamento desligado em desenvolvimento): 6 pacotes de R$ 4,90 a R$ 99,90 com
  bônus crescente; o de R$ 4,90 (3.000) já vale mais que uma semana jogando, o de R$ 19,90 (16.000) compra uma
  Especial na hora. Oferta de estreia: 8.000 por R$ 4,90, uma vez. Moedas só compram no leilão.
- **Eventos** (`/eventos`): segunda 0h → domingo 23h59 (Brasília), um tema por semana em rodízio
  (`event_templates`: Artilheiro, Muralha, Maratona, Rumo ao Título).
  - O fechamento da temporada e da copa grava os números de cada clube (jogos, vitórias, gols, jogos sem
    sofrer gol, goleadas, fases de copa) calculados pela Edge Function com o motor.
  - `my_event_progress()` soma o que **fechou na semana**; `claim_mission()` confere a meta e paga uma vez
    (`event_claims`). O que está em andamento aparece no aparelho como "a confirmar".

## Táticas avançadas e quadro animado (implementado)

- **Duração**: liga e copas a 6 s por minuto de jogo (90' + acréscimos ≈ 9,3–9,8 min). Treino mais rápido:
  1,8 s por minuto no 1x (~3 min), 0,8 s no 2x, 0,35 s no 4x. O placar mostra o minuto real (45+2', 90+3').
- **Três ajustes novos, estilo Brasfoot** (além de formação, postura, marcação e passes):
  linha defensiva (recuada / normal / adiantada), jogo (pelo meio / misto / pelas pontas) e ritmo
  (cadenciado / normal / acelerado). Cada um depende de quem está em campo:
  - pontas: rende com pontas e laterais rápidos/dribladores; pelo meio: com meias e atacantes técnicos;
  - linha adiantada: pressão e posse, mas espaço nas costas — só aguenta com zaga rápida contra atacante
    rápido; recuada: fecha a área (zaga lenta agradece), quase não sofre contra-ataque, cede a bola;
  - acelerado: mais ataques para time veloz e forte; cadenciado: chances melhores para meio que toca bem.
  - A tela de tática marca a opção "indicada" para os titulares (`tacticFit` no motor).
- **Compatibilidade**: com os três no "normal" o motor é idêntico ao anterior, sorteio por sorteio
  (`tests/tactics.test.ts` guarda a impressão digital de 300 jogos). Escalação ganha o trecho opcional
  `:LWT`; mudanças ao vivo `l0-2`, `w0-2`, `t0-2` (migração 0021).
- **Testes de encaixe** (`tests/tactics.test.ts`): times montados com perfis claros — cada opção vence quando o
  elenco encaixa e perde quando não encaixa; num time comum nenhuma domina (diferença < 0,12 gol/jogo).
- **Relógio do servidor nas mudanças ao vivo** (`0025_server_clock_changes.sql`): o aparelho não escolhe mais o
  minuto da mudança. A RPC `send_changes(escopo, id, fase, mudanças[])` calcula agora + 4 pelo relógio do servidor
  e grava tudo de uma vez (mesmas regras RLS); salvar de novo o mesmo ajuste nos mesmos 6 s vai para o minuto
  seguinte (ordem clara). A tela usa `serverNow()` (`lib/time.ts`), acertado uma vez por sessão com
  `server_now()` (`lib/clock.ts`): relógio de celular/PC atrasado não faz mais a mudança "chegar atrasada" nem
  mostra o minuto errado. Erros têm aviso próprio (sem conexão, sessão expirada, jogo acabando) e a folha fica
  aberta para tentar de novo.
- **Tática ao vivo (rascunho + Salvar)**: a folha de tática guarda um rascunho; "Salvar" envia só o que mudou,
  numa única escrita, tudo valendo no mesmo minuto (agora + 4). A tela mostra o que vai valer (`tacticAt` em
  `lib/tactics/live.ts`, com as mudanças agendadas): botão amarelo com o minuto no celular, aviso "Salvo, vale
  aos N'" no desktop, e "em campo" marcando o que ainda está valendo. As etiquetas do quadro seguem a postura em
  vigor de cada time. O motor junta as mudanças do mesmo time no mesmo minuto num lance só ("muda a tática:
  Ofensiva, linha adiantada e ritmo acelerado"); a narração tem sorteio próprio, então o placar não muda.
- **Narração (padrão do jogo)**: `Feed` (`components/match/parts.tsx`) recebe `teams` (sigla + escudo) e cada
  lance de um time mostra o escudo, o ícone do lance e a sigla; lances neutros deixam a coluna vazia. Liga, copas,
  amistosos, treino e laboratório usam o mesmo componente.
- **Câmera opcional**: por padrão a partida mostra só placar, narração e estatísticas. O botão de câmera
  (barra de baixo no celular; acima da narração na liga/copa no desktop; nos controles do treino) liga o quadro
  animado. A escolha fica no `localStorage` (`prancheta:camera`, via `lib/sim/useCamera.ts`); com a câmera
  desligada o `MatchBoard` nem é montado (sem loop de animação, mais leve no celular).
- **Quadro animado** (`lib/sim/board.ts` + `components/match/MatchBoard.tsx`), no treino, na liga e nas copas:
  o motor já sabe a partida inteira, então cada minuto vira um roteiro (quem tem a bola, passes, quem chuta).
  O lance narrado no minuto T é encenado entre T−1 e T e termina junto com o texto. Coerência garantida
  por `tests/board.test.ts` (24 partidas inteiras, quadro a quadro): gol termina na rede, defesa no goleiro,
  chute para fora nunca atravessa o goleiro, bloqueio no zagueiro, passes curtos (≤ 40) sem passar por
  adversário, ninguém sai do campo, saída de bola no meio depois do gol. Minuto com dois lances é dividido
  em dois trechos. O desenho atualiza só os atributos do SVG (sem re-render por quadro) e suaviza emendas.
- **Narração em sincronia** (`plan.eventAt`): cada texto aparece no instante em que o seu lance termina no
  quadro — num minuto com dois lances, o primeiro sai no meio do minuto e o segundo no fim. O placar conta só
  os gols já mostrados (`scoreAtTime`); a narração usa `visibleEvents`. Vale para treino, liga e copas.
- **Troca de lado**: no 2º tempo os times invertem o campo (o quadro espelha tudo a partir da saída do 2º
  tempo) e as etiquetas dos times trocam de lado junto.

## Laboratório de simulação (interno)

- **`/lab`** (sem link no jogo, fora dos buscadores): roda uma partida inteira entre times da CPU, sem banco e
  sem login, com o **mesmo** motor, roteiro e quadro do jogo. Parâmetros: `modo=online|treino`, `jogo=N`,
  `div=0..5`, `de=minuto`, `vel=X` (acelera), `debug=1` (painel com o trecho do roteiro, passes e bola).
- **Vídeo**: `npm run lab:video -- "modo=online&jogo=1&de=27&debug=1" 18 mobile nome` grava a página com o
  navegador, gera `.lab/nome.mp4`, os quadros (2 por segundo) e folhas de contato com o tempo de cada quadro
  (precisa do jogo rodando; `LAB_URL` muda o endereço).
- **Métricas**: `npm run lab:metrics` mede 40 partidas — vai-e-volta, construção antes do gol, saltos na troca
  de posse e bola parada no pé. Os limites estão em `tests/board.test.ts` ("jogadas com sentido").
- **Ritmo** (`lib/sim/pace.ts`): online 6 s por minuto (~10 min); treino 4,5 s por minuto no 1x (~7 min),
  2,2 s no 2x e 1 s no 4x.
- **O roteiro do quadro agora**: o minuto antes de um lance é a construção dele (o time sai do meio e chega à
  entrada da área); ninguém devolve a bola para quem acabou de passar; quem recebe conduz alguns metros; na
  troca de posse fica com a bola o jogador mais perto dela e a bola rola até ele; escanteio sem chute antes
  mostra a bola saindo pela linha de fundo; cada passe é conferido com as posições reais (longo ou com
  adversário no caminho → outro companheiro); o adversário na linha do passe "abre a brecha"; a posse
  mostrada acompanha a posse real do jogo; escanteios aparecem na narração ao vivo.

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
1. ~~Leilão (cartas Destaque, Épica e Especial; moedas e prêmios por temporada)~~ ✅
1. ~~Copa da Várzea~~ ✅
1. ~~Copa Nacional~~ ✅
1. ~~Supercopa~~ ✅
1. ~~Economia, loja (vitrine) e eventos semanais~~ ✅
1. ~~Táticas avançadas e quadro animado da partida~~ ✅
1. ~~Copa das Lendas~~ ✅; ~~amistosos entre amigos~~ ✅; pagamento da loja.
2. Motor de simulação completo (`lib/sim/`) com testes de determinismo.
3. Tela de escalação/prancheta.
4. Ligas da Várzea + job de rodadas.
5. Tela de partida ao vivo usando o motor real.
6. Leilão.
7. Amistosos por link.
