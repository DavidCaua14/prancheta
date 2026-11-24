# Prancheta ⚽📋

Manager de futebol online no navegador, com arte no estilo dos desenhos animados dos anos 90.
Monte seu clube, evolua cartas de jogadores, dispute ligas, copas, leilões e
amistosos contra técnicos de verdade — com partidas simuladas lance a lance.

## Rodando

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

## Estrutura

- `app/` — rotas (Next.js App Router). `app/api/version` informa a versão publicada.
- `components/landing/` — tela inicial.
- `components/ui/` — peças visuais cartoon (cartas, avatares, ícones, logo).
- `components/system/UpdateWatcher.tsx` — aviso de atualização obrigatória.
- `lib/game-config.ts` — regras do jogo (raridades, divisões, copas).
- `docs/ARQUITETURA.md` — decisões de arquitetura e próximos passos.
- `docs/PROMPTS-IMAGENS.md` — prompts para gerar a arte final. Salve as imagens em
  `public/art/` com o nome indicado e elas substituem os desenhos provisórios.

## Publicando uma atualização

1. Edite `RELEASE_NOTES` em `lib/version.ts`.
2. Faça o deploy. Quem estiver jogando verá o aviso e terá que atualizar.
