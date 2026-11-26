# Prancheta Temporadas — especificação para construção

> **Como usar este documento.** Entregue-o inteiro à IA/desenvolvedor junto com o repositório do Prancheta
> (o jogo online). Ele diz **o que** construir, **o que é proibido** (principalmente no banco de dados) e **em que
> ordem**. Onde houver "DECISÃO DO DONO", a IA deve perguntar antes de seguir — não escolher sozinha.
>
> Prompt sugerido para colar junto:
> *"Construa o Prancheta Temporadas seguindo `docs/PRANCHETA_TEMPORADAS.md` à risca. Comece pela Fase 0 e só avance
> de fase quando os critérios de aceite da fase atual passarem. Nunca crie tabela, coluna, RPC ou bucket que não esteja
> na seção 5 sem me perguntar. Reaproveite o motor, os componentes e o visual do Prancheta (seção 4.3)."*

---

## 1. Visão

**Prancheta Temporadas** é um manager de futebol **single-player e "offline"**, no estilo Brasfoot / Football
Manager, com a **mesma identidade visual** do Prancheta (cartoon anos 90, Bungee + Baloo 2, contornos grossos,
sombras sólidas).

- O jogador é um **técnico** (não dono do clube): começa num clube real de divisão baixa (ex.: Série D do Brasil,
  Segunda Federación da Espanha) e constrói a carreira — pode ser demitido, receber propostas e trocar de clube.
- **Reputação** é o eixo da carreira: define quais clubes oferecem emprego, o orçamento confiado e o respeito dos
  jogadores nas negociações.
- Manager completo: tática imersiva, elenco com atributos que importam, transferências negociadas com clube **e**
  jogador, contratos, CT, base, finanças, diretoria, calendário com ligas e copas reais.
- **Tudo roda no aparelho.** O servidor só guarda o progresso (backup) para a conta não se perder.
- **Função de negócio:** é a vitrine gratuita do Prancheta online (que será monetizado). Todo o fluxo deve levar,
  sem ser chato, a "agora jogue contra técnicos de verdade".

### 1.1 Não é

- Não é multiplayer, não tem ranking, mercado entre usuários nem nada que dependa de outro usuário.
- Não tem moeda paga nem anúncios.
- Não compartilha economia com o online (moedas do online nunca entram/saem daqui — ver seção 11).

---

## 2. Restrições inegociáveis

| # | Regra | Por quê |
|---|---|---|
| R1 | **Banco (Postgres) ≤ 300 bytes por slot** na tabela do Temporadas (só metadados), mais a linha de controle que o Storage cria por arquivo (~0,5–1 KB). **1 slot na nuvem por usuário por padrão** (até 3 locais). | Plano grátis: 500 MB de banco, hoje em 29 MB. 50 mil usuários × ~1,3 KB ≈ 65 MB. |
| R2 | **O save (blob) vai para o Supabase Storage, nunca para o banco.** Alvo ≤ 20 KB comprimido; limite duro 128 KB (bucket recusa acima). | Storage grátis = 1 GB → ~50 mil carreiras de 20 KB. |
| R3 | **Dados do mundo (clubes, elencos, competições) são arquivos estáticos** servidos pelo próprio site (pasta `public/`/CDN). Nunca no banco, nunca no Storage. | Não pesa no banco nem no egress do Supabase (5 GB/mês). |
| R4 | **Nenhuma escrita no banco durante o jogo.** Só em checkpoints (seção 6.4): no máximo 1 envio a cada 3 min, e só se o save mudou. | Banco e egress mínimos; o jogo continua 100% sem internet. |
| R5 | **Simulação 100% no aparelho**, em Web Worker, determinística (mesma semente → mesmo resultado). | Servidor não processa nada. |
| R6 | **IndexedDB é a fonte da verdade local** (não localStorage). A nuvem é cópia de segurança. | Saves maiores que 5 MB locais, histórico, autosaves. |
| R7 | Zero Edge Functions, zero cron, zero Realtime para o Temporadas. | Custo zero de servidor. |
| R8 | Nada no Temporadas pode dar vantagem no Prancheta online. | Integridade do jogo monetizado. |

**Orçamento (planilha de referência):**

| Recurso grátis | Limite | Uso previsto com 50 mil usuários |
|---|---|---|
| Banco | 500 MB | ~+65 MB: `tp_saves` (~300 B) + a linha que o Storage cria em `storage.objects` para cada arquivo (~0,5–1 KB) |
| Storage | 1 GB | ~1 GB no pior caso (50 mil × 20 KB) → com a limpeza de inativos (seção 5.4), bem menos |
| Egress | 5 GB/mês | Baixar save só quando a nuvem é mais nova que o aparelho: ~20 KB por troca de aparelho |
| Usuários ativos (auth) | 50 mil/mês | Conta compartilhada com o online (o mesmo login) |

Se crescer além disso, **o primeiro passo é o plano Pro do Supabase** — o formato não muda.

---

## 3. DECISÃO DO DONO — dados reais, nomes e escudos (ler antes de tudo)

Usar **escudos oficiais, nomes de competições e nomes/rostos de jogadores reais** envolve marcas registradas e
direitos de imagem. Mesmo sem cobrar, este jogo é propaganda de um produto pago (uso comercial). Clubes, ligas
(LaLiga, CBF etc.) e o sindicato de jogadores (FIFPro) licenciam isso a jogos — é o motivo de jogos como o Brasfoot
distribuírem o jogo com dados **editáveis** e a comunidade fazer "patches".

**Recomendação (padrão da especificação):**

1. **Pacote de dados separado do jogo** (seção 7). O jogo funciona com qualquer pacote que siga o formato.
2. O pacote **padrão** usa nomes de cidades/clubes reais escritos de forma "neutra" e **escudos gerados pelo próprio
   jogo** (o gerador `CrestSvg` do Prancheta com as cores do clube) — **não as logos oficiais**. Competições com nome
   genérico configurável (ex.: "Série D", "Copa do Brasil" podem ficar; "LaLiga" vira "Primeira Divisão Espanhola"),
   a critério do dono após consultar um advogado.
3. Jogadores reais: nome + posição + idade + atributos **estimados**. Nunca copiar bancos de dados protegidos
   (Football Manager, EA FC, Transfermarkt — os termos de uso proíbem extração). Dados montados à mão ou de fontes
   abertas com licença compatível.
4. **Editor/importador de pacote** dentro do jogo (Fase 6): o usuário pode carregar um pacote (.json) feito por ele.

> A IA **não** deve baixar logos oficiais nem raspar sites de dados. Se o dono decidir usar logos oficiais, ele
> fornece os arquivos e assume a licença; a IA só integra.

---

## 4. Arquitetura

### 4.1 Onde fica

**Recomendado:** no **mesmo projeto Next.js** do Prancheta, como uma área própria:

```
app/temporadas/            → landing e telas do Temporadas (rotas próprias)
lib/tp/                    → lógica do Temporadas (puro TypeScript, sem React)
lib/tp/worker/             → Web Worker de simulação
components/tp/             → componentes do Temporadas
public/tp/data/            → pacotes de dados estáticos (seção 7)
supabase/migrations/00xx_tp_saves.sql
```

Vantagens: mesmo login (Supabase Auth), mesmo design system, mesmo motor, e o botão "Jogar online" é só um link.
Se no futuro quiser outro domínio (ex.: temporadas.prancheta…), a pasta é extraída para outro deploy sem mudar a
lógica (o `lib/tp` não importa nada de `app/`).

### 4.2 Camadas

```
UI (React, components/tp)  ──pede──▶  Store da carreira (lib/tp/store, em memória)
                                         │  ▲
                        avançar o dia    ▼  │  estado novo
                                    Web Worker (lib/tp/worker): simula jogos, IA dos clubes, mercado
                                         │
                       autosave ─────────▼─────────▶ IndexedDB (fonte da verdade local)
                                                            │ checkpoint (seção 6.4)
                                                            ▼
                                      Supabase Storage (blob)  +  tp_saves (1 linha de metadados)
```

- **Determinismo:** toda aleatoriedade vem de `rng(semente)` derivada de `hash32(\`${saveSeed}:${contexto}\`)`
  (o Prancheta já tem `hash32` e `rng` em `lib/cards/generate.ts`/`lib/sim/engine.ts`). Nunca `Math.random()` na
  lógica de jogo.
- **Worker:** a UI nunca trava. "Continuar" (avançar dia/rodada) roda no worker e devolve o novo estado + notícias.
- **PWA:** manifesto + service worker para abrir sem internet depois do primeiro acesso (os pacotes de dados ficam no
  cache).

### 4.3 O que reaproveitar do Prancheta (obrigatório)

| Do Prancheta | Uso no Temporadas |
|---|---|
| `lib/sim/engine.ts` (`simulate`) | Motor das partidas — **estender**, não reescrever (seção 8). ~1 ms/jogo no servidor, ~3–4 ms no celular. |
| `lib/sim/board.ts`, `components/match/*` (`MatchBoard`, `Feed`, `Scoreboard`, `CameraButton`, `StatsPanel`) | Partida ao vivo com narração, câmera opcional e escudos na narração (padrão do jogo). |
| `lib/tactics/formations.ts`, `lib/tactics/lineup.ts` | Formações, posturas, marcação, passe, linha, amplitude, ritmo — base da tática (seção 9.6). |
| `components/club/CrestSvg.tsx`, `KitSvg.tsx`, `lib/club/identity.ts` | Escudos e uniformes gerados (pacote padrão). |
| `app/globals.css` (tokens `--ink`, `--night`, `--sun`, `--grass`…, classes `.btn`, `.tag`, `.t-heading`, `.t-num`) | Identidade visual idêntica. |
| `components/ui/ArtImg`, `Icon`, `Art` | Ícones e artes. |
| Padrões de desempenho já aplicados: `memo` em listas, só redesenhar o que mudou, caches por chave | Seção 12. |

---

## 5. Banco de dados (único lugar do servidor)

### 5.1 Migração (exatamente isto)

```sql
-- Prancheta Temporadas: só metadados do save. O save em si fica no Storage (bucket tp-saves).
create table if not exists public.tp_saves (
  user_id     uuid not null references auth.users (id) on delete cascade,
  slot        smallint not null check (slot between 0 and 2),  -- 0 por padrão; 1 e 2 só se o dono liberar
  version     integer not null default 1,           -- sobe a cada envio (controle de conflito)
  format      smallint not null,                    -- versão do formato do save (migrações)
  bytes       integer not null check (bytes between 1 and 131072),
  checksum    text not null check (char_length(checksum) <= 16),   -- hash curto do blob
  device      text check (char_length(device) <= 24),             -- id aleatório do aparelho
  summary     jsonb not null check (pg_column_size(summary) <= 160),
  -- summary: {"c":"Clube","d":"Série D","s":2031,"r":47,"t":2} = clube, divisão, temporada, reputação, títulos
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
  return v;  -- null = conflito (a nuvem tem versão mais nova)
end $$;
revoke all on function public.tp_commit(smallint, int, smallint, int, text, text, jsonb) from public, anon;
grant execute on function public.tp_commit(smallint, int, smallint, int, text, text, jsonb) to authenticated;
```

**Storage:** bucket privado `tp-saves`, limite de arquivo **128 KB**, tipo `application/octet-stream`.
Caminho: `{user_id}/{slot}.bin` (sobrescreve; sem histórico na nuvem). Políticas: `select/insert/update/delete`
só quando `(storage.foldername(name))[1] = auth.uid()::text`.

### 5.2 Proibido no banco

- Qualquer dado de jogador, clube, partida, estatística, notícia, histórico, tática ou transferência.
- Uma linha por ação/rodada/temporada. **Uma linha por slot, e só.**
- Logs, analytics de jogo, eventos. (Se quiser medir uso, o painel admin do online já conta "ativos" por `ping` —
  o Temporadas pode chamar o mesmo `ping('/temporadas/...')` no máximo 1×/min, como o online já faz.)

### 5.3 Painel admin (opcional, depois)

Somar ao painel `/admin` existente: total de carreiras, salvas nos últimos 7 dias, tamanho médio (`avg(bytes)`) e
o topo de reputação (lido de `summary`). Tudo com uma função `admin_tp_overview()` no padrão das `admin_*`.

### 5.4 Limpeza

Saves sem atualização há **180 dias** podem ser apagados da nuvem (o aparelho mantém a cópia). Fazer isso
**manualmente** pelo painel admin (botão "limpar saves inativos"), sem cron — R7.

---

## 6. O save

### 6.1 Princípio: guardar só o que não dá para recalcular

O mundo inicial vem do **pacote de dados** (estático) + **semente da carreira**. O save guarda apenas o que mudou
desde então. Tudo que é derivável (tabela de classificação, artilharia, valor de mercado, força do time, narração
de jogos passados) **não** vai no save: recalcula-se a partir dos resultados e da semente.

### 6.2 Conteúdo (formato `format = 1`)

| Bloco | Conteúdo | Tamanho típico (comprimido) |
|---|---|---|
| Cabeçalho | formato, id do pacote + versão, semente, data do jogo, slot | < 100 B |
| Técnico | nome, nacionalidade, idade, reputação, atributos do técnico, histórico de cargos (clube, período, títulos) | ~300 B |
| Mundo — clubes | só clubes que mudaram: caixa, folha salarial, nível do CT/base, técnico (se IA trocou) | ~1–2 KB |
| Mundo — jogadores | **diferenças** em relação ao pacote: clube, contrato (fim, salário, multa), atributos (delta int8 por atributo), condição física/moral só do seu clube, lesão/suspensão | ~6–10 KB |
| Regens (jovens gerados) | só a semente de geração + diferenças (o jogador nasce da semente) | ~1–2 KB |
| Temporada atual | resultados: 1 byte por jogo (gols mandante 4 bits + visitante 4 bits; >15 = raro, tabela de exceção); fase das copas; estatísticas individuais **só do seu elenco** | ~2–4 KB |
| Seu clube | tática(s) salva(s), escalação, treinos, olheiros, propostas em aberto, objetivos da diretoria, caixa de entrada (só não lidas + últimas 30) | ~1–2 KB |
| Histórico | por temporada: campeões das competições carregadas, sua campanha resumida (posição, pontos, artilheiro), sem jogos | ~40 B/temporada |

**Codificação:** binária (`DataView`/`TypedArray`, inteiros pequenos, ids numéricos do pacote, strings só para nomes
criados pelo usuário), depois `CompressionStream('gzip')`. Nada de JSON no blob.

**Metas verificadas por teste:** save de 1ª temporada ≤ 10 KB; depois de 10 temporadas ≤ 20 KB; nunca > 128 KB
(se passar, podar: caixa de entrada antiga, estatísticas de temporadas antigas, regens aposentados).

### 6.3 Versões do formato

`format` sobe quando o formato muda. `lib/tp/save/migrate.ts` converte saves antigos (cadeia `1→2→3…`). Teste
obrigatório: um save de cada formato antigo abre na versão atual.

### 6.4 Quando salvar

- **Local (IndexedDB):** a cada dia avançado (autosave rotativo de 3 posições) e ao fechar a aba.
- **Nuvem (checkpoint):** ao fim de cada rodada **ou** a cada 3 min de jogo ativo (o que vier depois), ao sair da
  tela ("Salvar e sair") e no fim da temporada — **só se o checksum mudou**. Sem internet: marca "pendente" e envia
  quando voltar.
- Ordem do envio: (1) `upload` do blob para `tp-saves/{uid}/{slot}.bin`, (2) `rpc('tp_commit', versão esperada)`.
  Se `tp_commit` devolver `null` (conflito), mostrar: "Este save foi alterado em outro aparelho em {data}. Qual
  manter?" com resumo de cada um (do `summary`).
- **Abrir o jogo:** lê só as linhas de `tp_saves` (~300 B). Baixa o blob **apenas** se a versão da nuvem for mais nova
  que a local.

---

## 7. Pacote de dados do mundo

### 7.1 Formato

```
public/tp/data/<pacote>/index.json          → países, divisões, competições, calendário, regras (≤ 30 KB)
public/tp/data/<pacote>/<pais>.json         → clubes + jogadores de um país (carregado sob demanda)
```

`index.json` (exemplo resumido):

```json
{
  "id": "padrao", "version": 3, "season": 2027,
  "countries": [{ "id": "br", "name": "Brasil", "file": "br.json" }, { "id": "es", "name": "Espanha", "file": "es.json" }],
  "competitions": [
    { "id": "br-d", "country": "br", "type": "league", "tier": 4, "name": "Série D", "format": "groups+knockout",
      "groups": 8, "promote": 4, "relegate": 0 },
    { "id": "br-cup", "country": "br", "type": "cup", "name": "Copa do Brasil", "legs": 2, "entry": ["br-a","br-b","br-c","br-d"] },
    { "id": "es-4", "country": "es", "type": "league", "tier": 4, "name": "Quarta Divisão Espanhola", "groups": 5,
      "teamsPerGroup": 18, "promote": "playoff", "relegate": 5 }
  ],
  "continental": [{ "id": "sa-1", "name": "Copa Continental Sul-Americana", "qualify": { "br-a": 6, "br-cup": 1 } }]
}
```

`<pais>.json`: listas compactas (arrays posicionais, não objetos), ids numéricos estáveis:

```json
{
  "clubs": [[101, "Nome do Clube", "SIG", "br-d", 1, [3,7,1,0,2,5], 1200, 45]],
  "players": [[50012, 101, "Nome Jogador", 24, "MEI", "D", [72,65,70, ...atributos...], 78, 3, 2028, 18000]]
}
```

Cada posição do array é documentada em `lib/tp/data/schema.ts` (validador + tipos). Ordem de grandeza:
Brasil (A–D) ~124 clubes / ~3.100 jogadores; Espanha (4 níveis) ~172 clubes / ~4.300 jogadores → ~150–250 KB
comprimido por país, baixados só quando a carreira usa o país.

### 7.2 Mundo "carregado" (como no FM)

Ao criar a carreira, o jogador escolhe **até 3 países carregados** (o do clube inicial é obrigatório). Países
carregados têm simulação completa e mercado detalhado. Os demais ficam **congelados** (elencos fixos; servem só
como fonte de propostas de técnico e de transferências raras). Isso mantém o save e o tempo de simulação pequenos.

---

## 8. Simulação

### 8.1 Três níveis de fidelidade

| Nível | Onde | Como |
|---|---|---|
| **Ao vivo** | Jogos do seu clube | `simulate` completo com narração, quadro animado (câmera), mudanças táticas e substituições em tempo real, como na partida do Prancheta. |
| **Completo, sem narração** | Demais jogos das competições do seu clube e dos países carregados | `simulate` sem gerar texto (adicionar flag `quiet: true` ao motor). Guarda só placar + autores dos gols do seu adversário direto, se necessário para notícias. |
| **Rápido** | Países congelados (se algum dia precisar de resultado) | Modelo estatístico (Poisson pela força dos times), ~0,01 ms/jogo. |

Custo estimado por temporada (3 países carregados, ~2.000 jogos) ≈ 2.000 × 4 ms ≈ 8 s no celular, **distribuídos**
pelas ~40 rodadas (~0,2 s por "Continuar"), no worker. Meta: "Continuar" ≤ 400 ms no celular médio.

### 8.2 Extensões do motor (`lib/sim/engine.ts`)

O motor atual usa cartas com `overall` e alguns `stats`. Para o Temporadas, **sem quebrar o online** (testes do
online devem continuar passando):

- Aceitar jogador com **atributos completos** (seção 9.7) e derivar internamente as notas que o motor já usa.
- **Condição física** (cai durante o jogo, mais com ritmo alto/pressão; afeta o rendimento no fim do jogo),
  **moral** e **entrosamento** como multiplicadores.
- **Função por posição** (seção 9.6) influencia quem participa de cada lance (ex.: lateral apoiador aparece mais em
  cruzamentos; volante destruidor mais em desarmes).
- Bola parada: batedor de falta/escanteio/pênalti escolhido pelo técnico usa os atributos dele.
- Lesões e cartões com probabilidade influenciada por atributos (agressividade, propensão a lesão — oculto).
- Flag `quiet` (sem narração) para a simulação em massa.

Teste obrigatório: com o mesmo elenco, um time com tática coerente com os atributos (ex.: time rápido + linha alta
+ contra-ataque) vence de forma mensurável um time com tática incoerente, em 2.000 simulações.

---

## 9. Sistemas de jogo

### 9.1 Carreira do técnico

- Criação: nome, nacionalidade, idade (30–60), **estilo preferido** (ofensivo, equilibrado, defensivo) e
  **formação de origem** (ex-jogador profissional / ex-amador / sem experiência → reputação inicial diferente).
- Atributos do técnico (0–20, sobem com o tempo e com cursos de licença): tática, motivação, desenvolvimento de
  jovens, disciplina, adaptabilidade, conhecimento de mercado, negociação.
- **Licenças** (Básica → A → Pro): cursos que custam tempo; clubes de elite exigem licença Pro.
- Escolha do clube inicial: lista só de clubes de **divisões baixas** (Série D / 4ª divisão espanhola etc.), com
  expectativa da diretoria, orçamento e força do elenco.

### 9.2 Reputação (0–100)

- Começa em 5–20 (conforme a formação de origem).
- Sobe com: vitórias acima do esperado (pela diferença de força), acessos, títulos, campanhas em copas, revelar
  jogadores vendidos caro, cumprir objetivos. Desce com: demissão, rebaixamento, sequência de derrotas, objetivos
  não cumpridos.
- Fórmula única em `lib/tp/career/reputation.ts`, com teste: ganhar a Série D com o pior orçamento rende mais que
  ganhar com o melhor.
- Exibida como número + selo (Desconhecido, Local, Regional, Nacional, Continental, Mundial).

### 9.3 Propostas de emprego e demissão

- Clubes com vaga (técnico demitido pela IA ou fim de contrato) avaliam técnicos pela reputação + histórico + estilo.
- Propostas chegam na caixa de entrada: clube, salário, duração, orçamento, **objetivos** e "promessas" (ex.: verba
  para reforços). O técnico pode aceitar, recusar ou negociar (salário/duração/verba).
- Sondagens antes da proposta formal ("o clube X tem interesse").
- **Diretoria** do clube atual: confiança 0–100 por objetivos (liga, copa, finanças, base). Confiança baixa → aviso →
  demissão. Demitido: fica desempregado, recebe propostas compatíveis (ou de clubes menores) com o tempo.
- Sair no meio do contrato: multa/impacto na reputação conforme o caso.

### 9.4 Finanças do clube

- Receitas: bilheteria (estádio × público × divisão), sócios, TV por divisão, premiação, vendas, patrocínio.
- Despesas: salários, bônus, manutenção do CT/estádio, base, olheiros.
- Orçamento de transferências e de salários definidos pela diretoria (ajustáveis por negociação).
- Clube endividado: limitações de mercado, venda forçada.

### 9.5 Transferências e negociação (estilo FM)

1. **Olheiros** descobrem jogadores (atributos aparecem com faixa de incerteza até o jogador ser observado).
2. **Proposta ao clube:** valor, parcelas, bônus por metas, % de revenda, troca por jogador, empréstimo (com opção de
   compra). O clube responde: aceita, recusa ou contraproposta (IA de negociação com limites e "paciência").
3. **Negociação com o jogador** (depois do aceite do clube): salário, duração, **papel no elenco** (estrela,
   titular, rodízio, reserva, promessa), bônus (por jogo, por gol, por título), multa rescisória, cláusula de
   aumento por acesso. O jogador considera: reputação do técnico, tamanho do clube, papel prometido, salário,
   divisão, idade. Promessa quebrada → moral cai e ele pede para sair.
4. Janelas de transferência conforme o país; agentes livres a qualquer momento.
5. **Renovação de contrato** e jogadores pedindo aumento; vendas iniciadas por outros clubes (propostas recebidas).
6. IA dos outros clubes compra/vende/empresta (só nos países carregados), com orçamento próprio.

### 9.6 Tática — imersão completa

Base: o que o Prancheta já tem (formações, postura, marcação, passe, linha, amplitude, ritmo) **mais**:

- **Funções por posição** (ex.: goleiro líbero, zagueiro construtor, lateral apoiador, volante destruidor/
  construtor, meia armador, ponta invertido, centroavante pivô/finalizador), cada uma com atributos-chave
  destacados na tela.
- **Instruções de equipe:** pressão (baixa/média/alta), contra-ataque, jogar pelas laterais/pelo meio, chutes de
  fora, perder tempo, foco em bola parada.
- **Instruções individuais** simples por jogador (marcar homem a homem, chutar mais, ficar mais atrás).
- **Bola parada:** batedores (pênalti, falta, escanteio), capitão.
- **Até 3 táticas salvas** (A/B/C) para trocar ao vivo, com o mesmo fluxo de "rascunho + Salvar" da partida do
  Prancheta.
- **Familiaridade** com a tática: cresce com treino e jogos; tática nova rende menos no começo.
- Tela mostra, para cada vaga, **o encaixe** do jogador (verde/amarelo/vermelho) — reaproveitar `fitLevel`.
- **Relatório do adversário** antes do jogo (formação provável, pontos fortes, jogadores perigosos) gerado do
  próprio motor/elenco.

### 9.7 Jogadores

- **Atributos 1–20**, agrupados:
  - técnicos: finalização, passe, cruzamento, drible, desarme, cabeceio, técnica, bola parada;
  - mentais: decisão, posicionamento, visão, determinação, trabalho em equipe, agressividade, liderança, frieza;
  - físicos: velocidade, aceleração, resistência, força, agilidade;
  - goleiro: reflexos, posicionamento, jogo aéreo, saída do gol, reposição.
- **Ocultos:** potencial, consistência, propensão a lesão, ambição, lealdade, profissionalismo.
- Derivados (exibidos): **overall por posição** (o mesmo jogador tem overall diferente como lateral e como ponta),
  valor de mercado, salário esperado.
- Estado: condição física, moral, forma (média das últimas notas), lesões (tipo + dias), suspensões.
- **Evolução:** por idade, potencial, minutos jogados, treino, nível do CT e desenvolvimento do técnico. Declínio após
  ~30 (físicos primeiro). Aposentadoria com idade + atributos.
- **Personalidade** afeta negociação, moral e resposta a conversas (ver 9.9).

### 9.8 CT, treino e base

- **CT (centro de treinamento):** níveis 1–10 (instalações de treino, base, médicas). Melhorias pedidas à diretoria
  (custam caixa e tempo de obra).
- **Treino semanal:** foco (físico, tático, técnico, bola parada, recuperação) e intensidade (risco de lesão ×
  evolução). Treino individual por jogador (posição nova, atributo específico).
- **Base:** todo ano nasce uma leva de jovens (regens) gerados da semente; qualidade conforme nível da base +
  reputação do clube + país. Promover, emprestar, dispensar.
- **Staff:** auxiliar técnico (sugere escalação/tática), preparador físico, fisioterapeuta, olheiros, treinador de
  goleiros — contratados com salário, atributos 1–20.

### 9.9 Gestão do vestiário

- Conversas com jogadores (elogiar, cobrar, prometer minutos, conversar sobre contrato) e com o elenco
  (antes do jogo, intervalo, depois do jogo) — reaproveitar o intervalo da partida ao vivo.
- Moral do grupo, líderes do elenco, panelinhas simples (mesma nacionalidade/idioma).

### 9.10 Competições e calendário

- Ligas com acesso/rebaixamento e formatos reais (grupos + mata-mata na Série D; grupos e playoffs nas divisões
  baixas espanholas), copas nacionais (ida e volta/jogo único conforme o pacote), supercopas, continentais por
  classificação. Tudo descrito no `index.json` — **nada de regra de competição escrita no código**.
- Calendário diário: dias de jogo, de treino, janelas de transferência, datas FIFA (convocações tiram jogadores).
- Desempate configurável por competição.

### 9.11 Caixa de entrada, notícias e histórico

- Caixa de entrada é o centro do jogo (propostas, lesões, diretoria, olheiros, jogadores pedindo conversa).
- Notícias geradas de templates (resultados surpreendentes, artilheiros, demissões, transferências).
- Histórico: carreira do técnico (clubes, títulos, % de vitórias), campeões por competição, recordes do clube,
  **Hall da Fama** do save.

---

## 10. Interface

- **Mesma identidade do Prancheta**: tokens de cor, fontes, `.btn`, painéis com borda de 3 px e sombra sólida,
  ilustrações no mesmo estilo (pedir prompts de imagem ao dono quando faltar arte — padrão do projeto).
- **Mobile-first**, sem rolagem lateral, menu inferior no celular e lateral no computador.
- **Tela inicial (logado no Temporadas)** semelhante à sede do Prancheta: cabeçalho com escudo e nome do clube,
  reputação do técnico, data do jogo e caixa; cartão "Próximo jogo"; atalhos (Elenco, Tática, Mercado, Caixa de
  entrada, Clube/CT, Competições, Calendário, Finanças, Carreira); botão grande **Continuar**.
- **Telas:** criação do técnico → escolha do país/clube → sede; elenco (lista + ficha do jogador com atributos,
  histórico, contrato); tática (campo com funções e encaixe); partida ao vivo (componentes do Prancheta);
  mercado/olheiros/negociação (diálogo de proposta e contraproposta); caixa de entrada; competições (tabelas,
  chaveamento, artilharia); calendário; finanças; CT/base/staff; carreira e histórico; configurações (slots, salvar
  na nuvem, importar pacote).
- **Landing pública** `/temporadas` (para quem não tem conta): o que é, prints, "Jogar grátis" (login obrigatório só
  para salvar na nuvem; dá para começar como convidado e criar conta depois sem perder o save local).

---

## 11. Ponte com o Prancheta online (objetivo de negócio)

- **Mesma conta.** O header do Temporadas tem um botão fixo "Prancheta Online — jogue contra técnicos reais".
- Momentos de convite (sem bloquear o jogo): após o 1º acesso, após o 1º título, a cada nova temporada, e na tela
  de fim de jogo. Texto curto, com o que o online tem de diferente (rivais reais, ranking, leilão, copas diárias).
- Do online para cá: na landing do online, um cartão "Treine no modo carreira — grátis".
- **Recompensa cruzada (opcional, R8):** só **cosmética** no online (ex.: moldura de escudo "Técnico de carreira")
  liberada uma vez por conta ao terminar a 1ª temporada — gravada num campo existente/novo do online decidido pelo
  dono, nunca moedas ou cartas. Como o save é local e manipulável, nada de valor pode depender dele.
- Medir conversão: contar quantas contas têm `tp_saves` **e** clube no online (consulta no admin).

---

## 12. Desempenho no aparelho

| Meta | Valor |
|---|---|
| Abrir o jogo (save local, dados em cache) | ≤ 1,5 s no celular médio |
| "Continuar" um dia sem jogo / dia de rodada | ≤ 100 ms / ≤ 400 ms (worker) |
| Partida ao vivo | igual ao Prancheta otimizado: narração/estatísticas/escudos em `memo`, quadro escreve só o que mudou |
| Memória | ≤ 150 MB com 3 países carregados |
| Listas grandes (elenco, mercado com milhares de jogadores) | virtualizadas; filtros no worker |

---

## 13. Fases (cada uma termina com os critérios de aceite passando)

| Fase | Entrega | Aceite |
|---|---|---|
| 0 | Esqueleto: rotas `/temporadas`, `lib/tp`, worker, IndexedDB, migração + bucket, `tp_commit`, save/carregar vazio na nuvem | Linha em `tp_saves` ≤ 300 B; blob no bucket; conflito entre 2 abas detectado |
| 1 | Pacote de dados (formato + validador) com 1 país pequeno; criação do técnico e escolha do clube; calendário e liga simulada (nível "completo") | Temporada inteira simulada; tabela correta; save ≤ 10 KB |
| 2 | Partida ao vivo com tática estendida (funções, instruções, táticas A/B/C) e atributos completos no motor | Teste de coerência tática (seção 8.2); testes do online intactos |
| 3 | Elenco, condição, moral, lesões, treino, evolução, base | 10 temporadas simuladas sem erro; save ≤ 20 KB |
| 4 | Mercado: olheiros, proposta a clube, negociação com jogador, IA de transferências, contratos | Negociação com contraproposta; promessa quebrada afeta moral |
| 5 | Carreira: reputação, diretoria, demissão, propostas de emprego, licenças | Técnico vencedor recebe propostas melhores; demitido recebe propostas menores |
| 6 | Copas nacionais/continentais, 2º e 3º país, histórico, notícias, importador de pacote | Formatos vindos só do `index.json` |
| 7 | Ponte com o online, landing, PWA offline, painel admin | Jogo abre sem internet; botão online em todas as telas principais |

---

## 14. Testes obrigatórios

- Determinismo: mesma semente + mesmas decisões → mesmo save (hash igual).
- Save: ida e volta (codificar → comprimir → descomprimir → decodificar) sem perda; migrações de formato.
- Tamanho: save após 1 e 10 temporadas dentro das metas (falha o build se passar).
- Banco: script que conta bytes por linha de `tp_saves` (≤ 300 B) e confere que nenhuma outra tabela foi criada.
- Competições: cada formato do `index.json` gera calendário válido (todos jogam o número certo de jogos).
- Motor: testes atuais do Prancheta continuam passando; teste de coerência tática.
- Interface: celular 390 px e computador 1440 px sem rolagem lateral, sem erros no console.

---

## 15. Fora de escopo (por enquanto)

Multiplayer, rankings entre usuários, chat, editor completo de banco de dados dentro do jogo (só importação de
pacote), narração por voz, partidas em 3D, monetização.
