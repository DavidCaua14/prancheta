# Prompts para gerar as imagens do Prancheta

Todas as imagens abaixo já têm lugar reservado na interface. Basta salvar o arquivo
em `public/art/` com o **nome exato** indicado (`.webp` ou `.png`), e o jogo troca o
desenho provisório pela imagem automaticamente — sem mexer em código.

> Dica: gere em PNG com fundo transparente. Se preferir, me envie os arquivos que eu
> recorto, comprimo em WebP e coloco no lugar certo.

---

## 1. Estilo base (cole no início de TODOS os prompts)

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

Para manter tudo com a mesma cara, gere **todos os itens de um mesmo grupo na mesma
sessão** (ou use a mesma seed / imagem de referência).

---

## 2. Troféus das copas — 1024 × 1024, fundo transparente

Aparecem em **Ligas e copas → Copas** (cards do mesmo tamanho).

| Arquivo | Prompt (depois do estilo base) |
| --- | --- |
| `trophy-copa-varzea.png` | `A humble but charming football cup trophy made of hammered bronze and orange enamel, a small football on top, wooden base with a tiny green grass tuft, slightly dented, front view, 3/4 angle.` |
| `trophy-copa-nacional.png` | `A tall elegant football cup trophy in silver with sky blue enamel ribbons on the handles, a football on the lid, dark navy base with a gold band, front view, 3/4 angle.` |
| `trophy-supercopa.png` | `A bold football trophy shaped like a big star-topped chalice in hot pink and silver, lightning-bolt shaped handles, stars sparkling around it, purple base, front view, 3/4 angle.` |
| `trophy-copa-lendas.png` | `The ultimate legendary football trophy, giant golden cup with laurel wreath handles, a glowing football on top, small gems (pink, blue, green) on the body, rays of light behind it, deep purple marble base, front view, 3/4 angle.` |

---

## 3. Escudos das divisões — 512 × 576, fundo transparente

Aparecem em **Ligas e copas → Divisões**. Mesmo formato de escudo em todos, só muda a
cor e o símbolo (sem letras — o nome aparece embaixo).

| Arquivo | Prompt (depois do estilo base) |
| --- | --- |
| `div-varzea.png` | `Football league crest badge, classic shield shape, brown and cream, symbol: a worn football on a dirt pitch with a small wooden goal, simple and humble.` |
| `div-serie-d.png` | `Football league crest badge, same classic shield shape, green and white, symbol: a single football with one small star above it.` |
| `div-serie-c.png` | `Football league crest badge, same classic shield shape, sky blue and white, symbol: a football with two small stars above it.` |
| `div-serie-b.png` | `Football league crest badge, same classic shield shape, orange and cream, symbol: a football with wings and three small stars.` |
| `div-serie-a.png` | `Football league crest badge, same classic shield shape, hot pink and white with a gold trim, symbol: a football inside a laurel wreath, four small stars.` |
| `div-liga-lendas.png` | `Football league crest badge, same classic shield shape, gold and deep purple, symbol: a crowned football with a big shining star, ornate gold trim, legendary feel.` |

---

## 4. Gemas de raridade das cartas — 512 × 512, fundo transparente

Aparecem no canto de cada carta e na legenda das raridades. Precisam ser legíveis em
tamanho bem pequeno (24 px), então formas simples.

| Arquivo | Prompt (depois do estilo base) |
| --- | --- |
| `gem-base.png` | `A round bronze medal coin, simple, chunky outline, small shine, game rarity icon.` |
| `gem-destaque.png` | `A sky blue diamond-shaped crystal gem, faceted, chunky outline, small shine, game rarity icon.` |
| `gem-epica.png` | `A purple hexagonal amethyst gem, faceted, chunky outline, glowing slightly, game rarity icon.` |
| `gem-especial.png` | `A golden five-pointed star gem with a small pink jewel in the center, sparkling, chunky outline, game rarity icon.` |

---

## 5. Ícones da interface — 512 × 512, fundo transparente

Aparecem dentro de quadrados coloridos (o quadrado é desenhado pelo site, então o
ícone **não** deve ter fundo nem moldura).

| Arquivo | Onde aparece | Prompt (depois do estilo base) |
| --- | --- | --- |
| `icon-clube.png` | Como funciona → Funde seu clube | `Icon of a football club crest shield with a star, simple bold shapes.` |
| `icon-tatica.png` | Como funciona → Arme a prancheta | `Icon of a coach's tactics clipboard with a tiny green football pitch, X and O marks and a curved arrow.` |
| `icon-ao-vivo.png` | Como funciona → A rodada acontece | `Icon of a chunky 90s CRT television with antennas showing a green football pitch, a small red "on air" light.` |
| `icon-acesso.png` | Como funciona → Suba de divisão | `Icon of a podium with a green upward arrow and a small golden trophy on top.` |
| `icon-gratis.png` | Vantagens → Grátis pra começar | `Icon of a gift box with a ribbon, a football peeking out of it.` |
| `icon-celular.png` | Vantagens → Roda no celular | `Icon of a smartphone showing a tiny football pitch on the screen.` |
| `icon-pvp.png` | Vantagens → Técnicos de verdade | `Icon of two cartoon hands in a handshake, one with a blue sleeve and one with a pink sleeve.` |
| `icon-leilao.png` | Leilão | `Icon of a wooden auction gavel hitting a small block, motion lines.` |
| `icon-moeda.png` | Leilão → maior lance | `Icon of a shiny gold game coin with a football engraved on it, slight 3/4 tilt.` |

---

## 6. Retratos dos jogadores das cartas — 1024 × 1024, fundo transparente

> **Não usado por enquanto:** os retratos serão gerados automaticamente pelo jogo.
> As cartas da tela inicial usam os avatares em SVG.

Aparecem no centro das cartas. **Enquadramento igual para todos:** busto de frente,
topo da cabeça a ~8% da borda de cima, ombros encostando na borda de baixo,
rosto centralizado, olhando para a frente com expressão confiante.

| Arquivo | Prompt (depois do estilo base) |
| --- | --- |
| `player-01.png` | `Bust portrait of a sturdy Brazilian football defender, dark brown skin, short black hair, full beard, serious tough expression, white jersey with a green vertical stripe.` |
| `player-02.png` | `Bust portrait of a fast young Brazilian winger, light skin, spiky blond mohawk, cheeky grin, sky blue jersey with a white stripe.` |
| `player-03.png` | `Bust portrait of a creative Brazilian midfielder, dark skin, big afro hairstyle with a yellow headband, smooth smile, hot pink jersey.` |
| `player-04.png` | `Bust portrait of a legendary Brazilian striker, tan skin, shaved bald head, confident smirk, yellow jersey with a green collar, tiny sparkles around him.` |

Para criar mais jogadores no futuro, mantenha esse mesmo modelo de prompt e numere
`player-05`, `player-06`, …

---

## 7. Marca do jogo — 512 × 576, fundo transparente

| Arquivo | Prompt (depois do estilo base) |
| --- | --- |
| `logo-mark.png` | `Game logo mascot icon: a chunky wooden coach's clipboard with a metal clip on top, showing a green mini football pitch with X and O tactics marks and a yellow curved arrow, slightly tilted, friendly and iconic.` |

O nome "PRANCHETA" continua sendo escrito pelo site (fonte Bungee), então a imagem
**não** deve ter texto.

---

## 8. Fundo da abertura — 1920 × 1080, WebP, sem transparência

| Arquivo | Prompt (depois do estilo base, **sem** a parte "isolated on a transparent background") |
| --- | --- |
| `hero-stadium.webp` | `Wide background illustration of a Brazilian football stadium at night seen from the stands, big floodlights with soft light beams, crowd silhouettes with colorful flags in the lower part, glowing green pitch in the distance, deep indigo night sky (#1d1650) with a few stars. Dark and calm, low contrast, lots of empty space on the left half for text. No text, no logos.` |

Ele aparece com transparência por trás do título, então pode ser bem detalhado sem
atrapalhar a leitura.

---

## 9. Telas do jogo (login, criação de clube, sede)

Use o mesmo **estilo base** da seção 1.

### Mascote — a assistente técnica

Aparece em todas as telas do jogo, falando com o jogador num balão. No desktop ela fica grande no canto direito;
no celular, pequena ao lado do balão.

| Arquivo | Tamanho | Prompt (depois do estilo base) |
| --- | --- | --- |
| `mascote.png` | 640 × 800 | `Friendly Brazilian female assistant football coach mascot, young woman with big curly dark hair in a ponytail, warm brown skin, confident friendly smile, wearing a dark green tracksuit jacket with yellow stripes on the sleeves and a small gold crown logo on the chest, a whistle on a cord around her neck, holding a small tactics clipboard in one hand and pointing to the left with the other, waist-up view, body slightly turned to the left, full figure cut at the hips at the bottom edge.` |

Para manter a mesma personagem em outras poses no futuro (comemorando, pensando, apontando para cima), gere a
partir desta imagem como referência.

### Faixas no topo dos painéis — 1200 × 400, **sem** transparência (WebP ou PNG)

Ficam atrás de uma borda grossa e, na criação do clube, os botões dos passos aparecem por cima da parte de
**baixo** da imagem — deixe a faixa inferior mais simples.

| Arquivo | Onde aparece | Prompt (depois do estilo base, **sem** "isolated on a transparent background") |
| --- | --- | --- |
| `banner-login.png` | Tela de login ("Entre em campo") | `Wide horizontal banner illustration of a cozy football locker room: wooden benches, colorful jerseys hanging on hooks (green, yellow, blue, pink), a tactics chalkboard with X and O marks, a ball and cleats on the floor, warm light. No people, no text. Simple and calm lower third.` |
| `banner-clube.png` | Tela de fundar o clube | `Wide horizontal banner illustration of a Brazilian várzea dirt football pitch at sunset, colorful small houses on a hill behind, a fence with a hand-painted empty sign board (no text), kids' kites in the orange-purple sky, a wooden goal with a torn net on the right, a few kids playing in the distance. No text. Simple and calm lower third.` |

### Fundo das telas do jogo (opcional) — 1920 × 1080, WebP

Hoje as telas do jogo usam o mesmo estádio da página inicial (`hero-stadium`). Se quiser um fundo próprio:

| Arquivo | Prompt (depois do estilo base, **sem** a parte de transparência) |
| --- | --- |
| `bg-jogo.webp` | `Wide background illustration of a Brazilian football stadium at night seen from the pitch level, green and yellow crowd with flags, big floodlights, empty center area with only soft blurred grass and sky, dark and calm, low contrast so panels on top stay readable. No text.` |

---

## 10. Menu do jogo (tela inicial do clube)

Ícones do menu inferior e dos atalhos. Mesmo formato da seção 5: **512 × 512, fundo transparente, sem moldura**.
Os outros ícones do menu reaproveitam artes que já existem (`icon-ao-vivo`, `icon-leilao`, `icon-clube`,
`icon-tatica`, `icon-pvp`, troféus).

| Arquivo | Onde aparece | Prompt (depois do estilo base) |
| --- | --- | --- |
| `icon-inicio.png` | Menu → Início | `Icon of a small cartoon football stadium seen from the front, green pitch, two floodlights and a little flag on top.` |
| `icon-elenco.png` | Menu → Elenco e atalho "Elenco" | `Icon of a fanned hand of three football player trading cards (bronze, blue and purple frames) with a small star on the front card.` |
