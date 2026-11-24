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

1. ~~Autenticação e criação de clube~~ ✅ (falta o elenco inicial de cartas Base, gerado por seed).
2. Motor de simulação completo (`lib/sim/`) com testes de determinismo.
3. Tela de escalação/prancheta.
4. Ligas da Várzea + job de rodadas.
5. Tela de partida ao vivo usando o motor real.
6. Leilão.
7. Amistosos por link.
