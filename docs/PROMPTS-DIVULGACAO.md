# Prompts das ilustrações de divulgação

Dois grupos de imagens:

- **A. Prancheta Online** — vão **dentro do Prancheta Temporadas** (os espaços da seção 4.2 de
  `PRANCHETA_TEMPORADAS.md`) para levar o jogador ao online. No online os times são **dos jogadores**, então estas
  imagens só mostram **escudos inventados**, no mesmo estilo dos escudos que o jogo gera. Nunca escudo real.
- **B. Prancheta Temporadas** — vão **no Prancheta Online e na página do Temporadas**, para apresentar o modo
  carreira. Aqui entram **clubes reais**, mas o escudo real **não é desenhado pela IA de imagem** (veja abaixo).

Salve em `public/art/` com o **nome exato** (PNG com fundo transparente quando indicado; se preferir, me envie os
arquivos que eu recorto, comprimo em WebP e coloco no lugar).

---

## Regras para todas as imagens

1. **Estilo base:** cole no início de **todos** os prompts o mesmo estilo base de `docs/PROMPTS-IMAGENS.md` (seção
   1), repetido aqui:

   ```
   1990s Saturday-morning cartoon style, like a classic 90s animated TV series and
   retro sports trading cards. Thick uniform black-purple outlines (#1b1038), flat
   cel shading with one hard shadow tone and one small white highlight, bold
   saturated palette: sunny yellow #ffd23f, grass green #34c759, hot pink #ff4f8b,
   sky blue #3ec5ff, purple #8b5cf6, orange #ff8a1f, cream #fff1d0. Subtle comic
   halftone dots in the shadows. Clean vector-like shapes, slightly chunky and
   playful proportions. Brazilian street-football vibe. Game UI asset, centered,
   isolated on a transparent background, no text, no letters, no watermark,
   no realistic 3D render, no pixel art.
   ```

   Nas imagens marcadas **"cena"** (sem transparência), troque o fim por: `full-bleed scene, no transparency, no
   text, no letters, no watermark, no realistic 3D render, no pixel art.`

2. **Sem texto na imagem.** Título, frase e botão são escritos pelo site, em português, por cima ou ao lado.
   Deixe a área indicada em cada prompt **limpa** para o texto.

3. **Mascote:** a assistente técnica do Prancheta (`mascote.png`) aparece em várias peças. Gere usando a imagem dela
   como **referência de personagem** para ficar a mesma pessoa. Descrição para colar quando ela aparecer:
   `the Prancheta mascot: friendly Brazilian female assistant football coach, young woman with big curly dark hair
   in a ponytail, warm brown skin, dark green tracksuit jacket with yellow stripes on the sleeves, whistle on a
   cord around her neck`.

4. **Escudos do online (grupo A):** sempre inventados, no estilo do gerador do jogo. Descrição para colar:
   `fictional football club crests made by players: simple classic shield shapes with bold stripes or halves in
   two flat colors and one simple emblem each (a crown, a star, a flame, a lightning bolt, a castle tower or a sun),
   no letters, no real club logos`.

5. **Escudos reais (grupo B):** a IA de imagem **não desenha** o escudo do clube. Ela deixa um **escudo em branco**
   no lugar, e o jogo coloca por cima o arquivo real do escudo (o mesmo que o Temporadas usa nas telas). Motivos:
   - IA de imagem deforma escudos (letras tortas, símbolos errados) e o torcedor percebe na hora;
   - com o arquivo real por cima, o escudo fica **exato** e dá para trocar o clube sem gerar a imagem de novo;
   - se algum clube pedir para sair, basta trocar o arquivo, não a ilustração.

   Descrição do escudo em branco para colar: `a plain blank cream (#fff1d0) shield badge with the same thick
   outline, perfectly flat and front-facing, no symbol, no stripes, no letters (it is a placeholder)`.
   Cada prompt do grupo B diz **onde** fica cada escudo em branco (em % da largura/altura), e o código usa essas
   posições para encaixar o escudo real.

---

## A. Prancheta Online (dentro do Temporadas)

### A1. Tela inicial — cartão grande `home-hero`

| Arquivo | Tamanho | Prompt (depois do estilo base) |
| --- | --- | --- |
| `promo-online-hero.png` | 1200 × 500, **cena** | `Wide banner scene of a night football stadium seen from the pitch. On the left touchline, a cartoon coach (man, 40s, cap, tracksuit) holds a smartphone; on the far right touchline, a different cartoon coach (woman, 30s, braids, hoodie) also holds a smartphone. A glowing yellow dashed lightning line connects the two phones across the pitch, showing they are real people playing against each other live. Each coach has a dugout behind them with a big fictional player-made crest (see crest rule). Crowd with green, pink and blue flags. Keep the left 45% of the image darker and simple (title text goes there), main action in the right 55%.` |

### A2. Coluna lateral — novidades que giram `home-side`

Quatro peças, uma para cada atrativo do online. Mesmo enquadramento em todas.

| Arquivo | Tamanho | Prompt (depois do estilo base) |
| --- | --- | --- |
| `promo-online-leilao.png` | 800 × 800 | `Auction scene icon: a big wooden auction gavel striking, three football player trading cards flying out with sparkles (bronze, purple and golden frames), coins bursting around, dynamic and exciting, centered composition.` |
| `promo-online-copa.png` | 800 × 800 | `A shiny bronze-and-orange football cup trophy on a small podium next to a tear-off daily calendar page with a football drawn on it, confetti falling, 32 tiny fictional crests arranged in a bracket shape behind it (see crest rule), centered.` |
| `promo-online-ranking.png` | 800 × 800 | `A three-step winners podium with three different fictional player-made crests on top (see crest rule), the first place crest glowing with a golden crown floating above it, rising arrows and stars around, centered.` |
| `promo-online-amistoso.png` | 800 × 800 | `Two hands holding smartphones giving a high five, each phone screen showing a different fictional crest (see crest rule), a small football and sparkles between them, friendly and fun, centered.` |

### A3. Partida — antes, intervalo e fim `match-pre`, `match-half`, `match-end`

| Arquivo | Tamanho | Prompt (depois do estilo base) |
| --- | --- | --- |
| `promo-online-vs.png` | 1200 × 400, **cena** | `Wide strip: two big fictional crests (see crest rule) facing each other in the center with a jagged yellow "versus" lightning burst between them (no letters), each crest held up by a different cartoon coach's hand holding a phone, stadium lights and crowd blurred behind. Leave the outer left and right 20% simple for text.` |
| `promo-online-intervalo.png` | 600 × 600 | `The Prancheta mascot (see mascot rule) in the locker room at halftime, holding a smartphone toward the viewer, the phone screen shows a tiny tactics board with arrows changing, a speech-bubble-shaped glow (empty) above the phone, energetic pose.` |
| `promo-online-vitoria.png` | 800 × 600 | `The Prancheta mascot (see mascot rule) celebrating a win, jumping with one fist up, holding a smartphone in the other hand pointing it forward like a challenge, behind her a giant fictional crest (see crest rule) with a question mark-shaped spotlight beam (no letters) representing a mystery human rival, confetti.` |
| `promo-online-derrota.png` | 800 × 600 | `The Prancheta mascot (see mascot rule) with a determined smile after a loss, rolling up her sleeves, a fanned hand of shiny football trading cards floating next to her (bronze, blue, purple, golden frames) and an auction gavel, message of "build a stronger squad", warm light.` |

### A4. Caixa de entrada, notícias e carregamento `inbox`, `news`, `loading`

| Arquivo | Tamanho | Prompt (depois do estilo base) |
| --- | --- | --- |
| `promo-online-carta.png` | 512 × 512 | `Avatar icon for an inbox message: a yellow envelope with a small football wax seal, a tiny smartphone peeking out of it with a glowing screen, simple bold shapes, readable at 48 px.` |
| `promo-online-jornal.png` | 1200 × 600, **cena** | `Newspaper-photo style cartoon scene (still in the same 90s cartoon style): a packed small stadium celebrating, players in fictional kits lifting a cup trophy, many phone screens in the crowd glowing, fictional crests on the flags (see crest rule). Leave the top 25% as plain sky for a headline.` |
| `promo-online-dica-1.png` | 512 × 512 | `Icon: a smartphone with a football pitch on the screen and two small person silhouettes (one on each half), signal waves coming out of the phone.` |
| `promo-online-dica-2.png` | 512 × 512 | `Icon: an alarm clock with a football face showing the time, small cup trophy next to it (daily cup every day).` |
| `promo-online-dica-3.png` | 512 × 512 | `Icon: a stack of three football trading cards with a gavel on top and two coins.` |

### A5. Mercado, carreira, fim de temporada e conquistas `market`, `career`, `season-end`, `milestone`

| Arquivo | Tamanho | Prompt (depois do estilo base) |
| --- | --- | --- |
| `promo-online-mercado.png` | 1200 × 300, **cena** | `Very wide thin strip: football trading cards flying from left to right in a row with motion trails (bronze, blue, purple, golden frames), an auction gavel on the right end, coins sparkling, dark purple background. Keep the left 40% calm for text.` |
| `promo-online-carreira.png` | 800 × 600 | `A tall glowing leaderboard board in a stadium tunnel, rows of small fictional crests (see crest rule) with a gold, silver and bronze medal on the top three rows, an empty highlighted row in the middle with a spotlight on it, as if waiting for the viewer's name (no letters).` |
| `promo-online-temporada.png` | 1200 × 800, **cena** | `The Prancheta mascot (see mascot rule) standing at the end of a stadium tunnel, pointing toward a huge bright doorway that opens onto a packed night stadium full of flags with fictional player-made crests (see crest rule) and glowing phone screens in the crowd, inviting the viewer to step into the online arena. Leave the top 30% simple for the title.` |
| `promo-online-conquista.png` | 800 × 800 | `A golden cup trophy on a pedestal with confetti and fireworks, a smartphone leaning against the pedestal whose screen shows a glowing versus lightning between two fictional crests (see crest rule), celebratory.` |

### A6. Página do Temporadas — seção sobre o online `landing`

| Arquivo | Tamanho | Prompt (depois do estilo base) |
| --- | --- | --- |
| `promo-online-landing.png` | 1600 × 900, **cena** | `Split scene: on the left half, a cozy desk at night with a laptop showing a football manager screen and a cup of coffee (single-player career); on the right half, the same desk opens into a bright packed online stadium with many glowing phones and fictional player-made crests on flags (see crest rule); a glowing path of light connects the two halves. Calm area at the top center for the title.` |

> O item "Online" do menu do Temporadas reaproveita o ícone que já existe no Prancheta (`icon-pvp`), para o jogador
> reconhecer o mesmo jogo.

---

## B. Prancheta Temporadas (no online e na página do Temporadas)

Escudos reais entram por cima dos **escudos em branco** (regra 5). Junto de cada prompt vai a posição do centro de
cada escudo em branco, em % da largura (x) e altura (y), e o tamanho aproximado, para eu encaixar o escudo real.

| Arquivo | Tamanho | Prompt (depois do estilo base) | Escudos em branco |
| --- | --- | --- | --- |
| `promo-tp-hero.png` | 1200 × 500, **cena** | `Wide career-journey banner: a cartoon football coach in a smart tracksuit with a clipboard walks along a winding path from left to right. On the left, a humble small-town stadium with a wooden stand and a few fans; in the middle, a medium stadium; on the right, a huge glowing stadium with floodlights and a packed crowd. Each stadium has one big blank shield badge on its facade (see blank shield rule). Sunrise sky, sense of a long career ahead. Keep the top-left 35% calm for the title.` | 3: (18%, 55%, 9% da largura), (50%, 45%, 11%), (82%, 35%, 14%) |
| `promo-tp-cartao.png` | 800 × 800 | `Cartoon football coach at a desk in a small club office at night, reading job offer letters; three envelopes fly toward him, each sealed with a big blank wax-seal shield badge (see blank shield rule); a tactics board and a small trophy shelf behind him. Centered composition.` | 3 selos: (25%, 30%, 13%), (50%, 20%, 13%), (75%, 30%, 13%) |
| `promo-tp-proposta.png` | 800 × 600 | `A club president in a suit shaking hands with a cartoon football coach in a boardroom, a big blank shield badge on the wall behind them (see blank shield rule), a contract on the table with a pen, warm light, sense of achievement.` | 1: (50%, 25%, 20%) |
| `promo-tp-elenco.png` | 800 × 800 | `Cartoon football squad photo: eleven players in plain two-color kits (no logos on the shirts) posing in two rows on a pitch, the coach standing on the side with arms crossed, a big blank shield badge on the advertising board behind them (see blank shield rule). Friendly and proud.` | 1: (50%, 18%, 16%) |
| `promo-tp-landing.png` | 1920 × 1080, **cena** | `Wide hero background: a coach's office at dusk overlooking a stadium through a big window; on the desk, a laptop with a league table, scouting folders, a contract and a mug; on the wall, three blank shield badges in frames like career memories (see blank shield rule). Calm, dark-enough left half for text.` | 3 quadros: (62%, 28%, 7%), (72%, 28%, 7%), (82%, 28%, 7%) |
| `icon-temporadas.png` | 512 × 512 | `Icon: a tactics clipboard with a small calendar page clipped on top and a football, a tiny star above it (career mode), simple bold shapes, readable at 48 px.` | — |

**Quais clubes reais aparecem por cima:** o código escolhe na hora, entre os clubes do pacote de dados do
Temporadas (ex.: um clube da Série D no estádio pequeno e clubes de divisões maiores nos outros), e pode variar a
cada visita. Por isso não é preciso escolher nem pesquisar escudos agora: as imagens ficam prontas para qualquer
clube, com o escudo sempre exato.
